import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature') || ''
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!

  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex')
  if (expectedSig !== signature) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)
  await connectDB()

  if (event.event === 'payment.captured') {
    const notes = event.payload.payment.entity.notes || {}
    const userId = notes.userId
    const plan = notes.plan

    if (userId) {
      const periodEnd = plan === 'yearly'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await User.findByIdAndUpdate(userId, {
        'subscription.status': 'active',
        'subscription.plan': plan,
        'subscription.currentPeriodEnd': periodEnd,
        'subscription.razorpayCustomerId': event.payload.payment.entity.customer_id || '',
      })
    }
  }

  if (event.event === 'subscription.cancelled') {
    const userId = event.payload.subscription.entity.notes?.userId
    if (userId) {
      await User.findByIdAndUpdate(userId, { 'subscription.status': 'cancelled' })
    }
  }

  return Response.json({ received: true })
}

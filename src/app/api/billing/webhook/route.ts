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
    const orderType = notes.orderType
    const credits = Number(notes.credits || 0)

    if (userId) {
      if (orderType === 'credits_topup') {
        await User.findByIdAndUpdate(userId, {
          $inc: { 'usage.extraCreditsBalance': credits },
          $set: { 'subscription.razorpayCustomerId': event.payload.payment.entity.customer_id || '' },
        })
      } else {
        // Both starter and pro are monthly billing (30-day period).
        // Legacy 'yearly' plan stored in old orders also maps to 30-day period now.
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        // Normalise legacy plan names to canonical ones
        const canonicalPlan = plan === 'monthly' ? 'starter' : plan === 'yearly' ? 'pro' : plan

        const { PLAN_CREDITS } = await import('@/lib/ai-usage')

        await User.findByIdAndUpdate(userId, {
          'subscription.status': 'active',
          'subscription.plan': canonicalPlan,
          'subscription.currentPeriodEnd': periodEnd,
          'subscription.razorpayCustomerId': event.payload.payment.entity.customer_id || '',
          'usage.monthlyCredits': PLAN_CREDITS[canonicalPlan] ?? 150,
        })
      }
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

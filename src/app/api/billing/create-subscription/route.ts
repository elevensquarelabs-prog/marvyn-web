import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import Razorpay from 'razorpay'

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

const PLANS = {
  monthly: { amount: 69900, period: 'monthly', interval: 1 }, // ₹699 in paise
  yearly: { amount: 499900, period: 'yearly', interval: 1 },  // ₹4999 in paise
}

const CREDIT_PACKS = {
  credits_100: { amount: 29900, credits: 100, label: '100 Credits Pack' },
  credits_250: { amount: 59900, credits: 250, label: '250 Credits Pack' },
  credits_500: { amount: 99900, credits: 500, label: '500 Credits Pack' },
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { plan } = await req.json()
  const planConfig = PLANS[plan as keyof typeof PLANS]
  const creditPack = CREDIT_PACKS[plan as keyof typeof CREDIT_PACKS]
  if (!planConfig && !creditPack) return Response.json({ error: 'Invalid plan' }, { status: 400 })

  const user = await User.findById(session.user.id)
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

  const razorpay = getRazorpay()
  const order = await razorpay.orders.create({
    amount: planConfig?.amount ?? creditPack!.amount,
    currency: 'INR',
    receipt: `order_${session.user.id}_${Date.now()}`,
    notes: {
      userId: session.user.id,
      plan,
      orderType: creditPack ? 'credits_topup' : 'subscription',
      credits: creditPack?.credits ? String(creditPack.credits) : '',
    },
  })

  return Response.json({
    orderId: order.id,
    amount: planConfig?.amount ?? creditPack!.amount,
    currency: 'INR',
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    userName: user.name,
    userEmail: user.email,
    label: creditPack?.label ?? (plan === 'monthly' ? 'Monthly Plan' : 'Yearly Plan'),
    credits: creditPack?.credits ?? null,
  })
}

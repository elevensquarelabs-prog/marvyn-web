import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import BetaRequest from '@/models/BetaRequest'
import User from '@/models/User'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'
const BETA_EXPIRY = new Date('2099-12-31')

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const { betaRequestId } = await req.json()

  const betaReq = await BetaRequest.findById(betaRequestId)
  if (!betaReq) return Response.json({ error: 'Not found' }, { status: 404 })

  const temporaryPassword = randomBytes(8).toString('hex')
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

  // If user already exists, upgrade their subscription and reset password
  const existing = await User.findOne({ email: betaReq.email })
  if (existing) {
    await User.findByIdAndUpdate(existing._id, {
      password: hashedPassword,
      mustResetPassword: true,
      'subscription.status': 'active',
      'subscription.plan': 'beta',
      'subscription.currentPeriodEnd': BETA_EXPIRY,
    })
    await BetaRequest.findByIdAndUpdate(betaRequestId, { status: 'approved' })
    console.log(`[admin/approve] Upgraded existing user ${betaReq.email} — temp password: ${temporaryPassword}`)
    return Response.json({
      success: true,
      userId: existing._id,
      email: betaReq.email,
      temporaryPassword,
    })
  }

  const user = await User.create({
    name: betaReq.name,
    email: betaReq.email,
    password: hashedPassword,
    mustResetPassword: true,
    subscription: {
      status: 'active',
      plan: 'beta',
      currentPeriodEnd: BETA_EXPIRY,
    },
  })

  await BetaRequest.findByIdAndUpdate(betaRequestId, { status: 'approved' })
  console.log(`[admin/approve] Approved ${betaReq.email} — temp password: ${temporaryPassword}`)

  return Response.json({
    success: true,
    userId: user._id,
    email: betaReq.email,
    temporaryPassword,
  })
}

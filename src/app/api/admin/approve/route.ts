import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import BetaRequest from '@/models/BetaRequest'
import User from '@/models/User'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

const ADMIN_EMAILS = ['raayed32@gmail.com']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()
  const { betaRequestId } = await req.json()

  const betaReq = await BetaRequest.findById(betaRequestId)
  if (!betaReq) return Response.json({ error: 'Not found' }, { status: 404 })

  // Check if user already exists
  const existing = await User.findOne({ email: betaReq.email })
  if (existing) {
    await BetaRequest.findByIdAndUpdate(betaRequestId, { status: 'approved' })
    return Response.json({ success: true, message: 'User already exists', userId: existing._id })
  }

  const temporaryPassword = randomBytes(8).toString('hex')
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

  const user = await User.create({
    name: betaReq.name,
    email: betaReq.email,
    password: hashedPassword,
    subscription: {
      status: 'trial',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

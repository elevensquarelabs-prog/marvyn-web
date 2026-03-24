import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import BetaRequest from '@/models/BetaRequest'
import User from '@/models/User'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
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
      status: 'active',
      plan: 'beta',
      currentPeriodEnd: new Date('2099-12-31'),
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

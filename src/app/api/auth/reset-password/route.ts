import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import Token from '@/models/Token'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { newPassword, token } = await req.json()

  if (!newPassword || newPassword.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  await connectDB()
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  // Token-based reset (forgot password flow)
  if (token) {
    const record = await Token.findOne({
      token,
      type: 'password_reset',
      expiresAt: { $gt: new Date() },
      usedAt: { $exists: false },
    })
    if (!record) {
      return Response.json({ error: 'Reset link is invalid or has expired' }, { status: 400 })
    }
    await User.findByIdAndUpdate(record.userId, {
      password: hashedPassword,
      mustResetPassword: false,
    })
    await Token.findByIdAndUpdate(record._id, { usedAt: new Date() })
    return Response.json({ success: true })
  }

  // Session-based reset (first login / mustResetPassword flow)
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await User.findByIdAndUpdate(session.user.id, {
    password: hashedPassword,
    mustResetPassword: false,
  })

  return Response.json({ success: true })
}

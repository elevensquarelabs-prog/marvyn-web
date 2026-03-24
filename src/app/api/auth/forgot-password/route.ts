import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import Token from '@/models/Token'
import { sendPasswordResetEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

  await connectDB()
  const user = await User.findOne({ email: email.toLowerCase() }).select('_id email name')

  // Always return success to not expose whether email exists
  if (!user) return Response.json({ success: true })

  // Invalidate any existing reset tokens for this user
  await Token.deleteMany({ userId: user._id, type: 'password_reset' })

  const token = randomBytes(32).toString('hex')
  await Token.create({
    userId: user._id,
    email: user.email,
    token,
    type: 'password_reset',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  })

  await sendPasswordResetEmail(user.email, token).catch(err =>
    console.error('[forgot-password] email send failed:', err)
  )

  return Response.json({ success: true })
}

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import Token from '@/models/Token'
import { sendVerificationEmail } from '@/lib/email'
import { randomBytes } from 'crypto'
import { redirect } from 'next/navigation'

// POST — send verification email (requires session)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const user = await User.findById(session.user.id).select('email emailVerified')
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
  if (user.emailVerified) return Response.json({ error: 'Already verified' }, { status: 400 })

  // Rate-limit: one per 2 minutes
  const recent = await Token.findOne({
    userId: user._id,
    type: 'email_verification',
    expiresAt: { $gt: new Date(Date.now() + 24 * 60 * 60 * 1000 - 2 * 60 * 1000) },
  })
  if (recent) return Response.json({ error: 'Email already sent recently' }, { status: 429 })

  await Token.deleteMany({ userId: user._id, type: 'email_verification' })

  const token = randomBytes(32).toString('hex')
  await Token.create({
    userId: user._id,
    email: user.email,
    token,
    type: 'email_verification',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  })

  await sendVerificationEmail(user.email, token).catch(err =>
    console.error('[send-verification] email send failed:', err)
  )

  return Response.json({ success: true })
}

// GET — verify the token from the link in the email
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return redirect('/login?error=invalid-token')

  await connectDB()
  const record = await Token.findOne({
    token,
    type: 'email_verification',
    expiresAt: { $gt: new Date() },
    usedAt: { $exists: false },
  })

  if (!record) return redirect('/login?error=invalid-token')

  await User.findByIdAndUpdate(record.userId, { emailVerified: new Date() })
  await Token.findByIdAndUpdate(record._id, { usedAt: new Date() })

  return redirect('/dashboard?verified=1')
}

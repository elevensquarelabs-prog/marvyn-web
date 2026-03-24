import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import Brand from '@/models/Brand'
import Token from '@/models/Token'
import { sendWelcomeEmail, sendVerificationEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return Response.json({ error: 'Name, email and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    await connectDB()

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return Response.json({ error: 'Email already registered' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
    })

    await Brand.create({ userId: user._id })

    // Send welcome + verification emails (non-blocking)
    const verifyToken = randomBytes(32).toString('hex')
    await Token.create({
      userId: user._id,
      email: user.email,
      token: verifyToken,
      type: 'email_verification',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }).catch(() => {})

    sendWelcomeEmail(user.email, user.name).catch(() => {})
    sendVerificationEmail(user.email, verifyToken).catch(() => {})

    return Response.json({ success: true, userId: user._id.toString() }, { status: 201 })
  } catch (err) {
    console.error('[register]', err)
    return Response.json({ error: 'Registration failed' }, { status: 500 })
  }
}

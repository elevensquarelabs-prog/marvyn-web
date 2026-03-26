import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '@/models/User'

const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'
const BETA_EXPIRY = new Date('2099-12-31')

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()

  const users = await mongoose.connection.db!
    .collection('users')
    .find({}, {
      projection: {
        password: 0,
        'connections.meta.accessToken': 0,
        'connections.google.accessToken': 0,
        'connections.google.refreshToken': 0,
        'connections.searchConsole.accessToken': 0,
        'connections.searchConsole.refreshToken': 0,
        'connections.linkedin.accessToken': 0,
        'connections.facebook.accessToken': 0,
        'connections.facebook.pageAccessToken': 0,
        'connections.clarity.apiToken': 0,
      },
    })
    .sort({ createdAt: -1 })
    .toArray()

  return Response.json({ users })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const body = await req.json()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!name || !email || !password) {
    return Response.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const existing = await User.findOne({ email }).lean()
  if (existing) {
    return Response.json({ error: 'A user with this email already exists' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    emailVerified: new Date(),
    mustResetPassword: false,
    subscription: {
      status: 'active',
      plan: 'beta',
      currentPeriodEnd: BETA_EXPIRY,
    },
  })

  return Response.json({
    success: true,
    user: {
      _id: String(user._id),
      name: user.name,
      email: user.email,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()
  const body = await req.json()
  const { id, action, monthlyCredits, extraCredits } = body

  if (action === 'set_monthly_credits') {
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { 'usage.monthlyCredits': Number(monthlyCredits) } }
    )
    return Response.json({ success: true, monthlyCredits: Number(monthlyCredits) })
  }

  if (action === 'add_extra_credits') {
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $inc: { 'usage.extraCreditsBalance': Number(extraCredits || 0) } }
    )
    return Response.json({ success: true })
  }

  if (action === 'reset_usage_cycle') {
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          'usage.estimatedCostUsdThisMonth': 0,
          'usage.tokensUsedThisMonth': 0,
          'usage.creditsUsedThisMonth': 0,
          'usage.lastCreditsResetAt': new Date(),
        },
      }
    )
    return Response.json({ success: true })
  }

  const status = action === 'revoke' ? 'revoked' : 'trial'
  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: { 'subscription.status': status } }
  )
  return Response.json({ success: true, status })
}

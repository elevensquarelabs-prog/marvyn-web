import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '@/models/User'
import { requireAdmin } from '@/lib/admin-auth'

const BETA_EXPIRY = new Date('2099-12-31')

export async function GET(req: NextRequest) {
  try { await requireAdmin(req) } catch (res) { return res as Response }
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
  try { await requireAdmin(req, 'super_admin') } catch (res) { return res as Response }
  await connectDB()
  const body = await req.json()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const plan = String(body.plan || 'starter') as 'starter' | 'pro' | 'beta'

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
  const { PLAN_CREDITS } = await import('@/lib/ai-usage')

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    emailVerified: new Date(),
    mustResetPassword: false,
    subscription: {
      status: 'active',
      plan,
      currentPeriodEnd: BETA_EXPIRY,
    },
    usage: {
      monthlyCredits: PLAN_CREDITS[plan] ?? 150,
    },
  })

  return Response.json({
    success: true,
    user: { _id: String(user._id), name: user.name, email: user.email, plan },
  })
}

export async function PATCH(req: NextRequest) {
  // Minimum gate: support. Financial actions are re-checked for super_admin below.
  let admin; try { admin = await requireAdmin(req, 'support') } catch (r) { return r as Response }
  await connectDB()
  const body = await req.json()
  const { id, action, monthlyCredits, extraCredits, plan } = body

  // Financial actions require super_admin
  const superAdminActions = ['set_monthly_credits', 'add_extra_credits', 'change_plan']
  if (superAdminActions.includes(action) && admin.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden — super_admin only' }, { status: 403 })
  }

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

  if (action === 'change_plan') {
    const { PLAN_CREDITS } = await import('@/lib/ai-usage')
    const credits = PLAN_CREDITS[plan] ?? 150
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { 'subscription.plan': plan, 'usage.monthlyCredits': credits } }
    )
    return Response.json({ success: true, plan, credits })
  }

  const status = action === 'revoke' ? 'revoked' : 'trial'
  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: { 'subscription.status': status } }
  )
  return Response.json({ success: true, status })
}

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import AdminUser from '@/models/AdminUser'
import User from '@/models/User'
import { signAdminToken, getAdminCookieOptions, COOKIE_NAME } from '@/lib/admin-auth'
import type { AdminRole } from '@/models/AdminUser'

const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return Response.json({ error: 'Email and password required' }, { status: 400 })
  }

  await connectDB()

  let adminId: string
  let name: string
  let role: AdminRole

  // Find in AdminUser collection
  let adminUser = await AdminUser.findOne({ email: email.toLowerCase() })

  if (!adminUser) {
    // ⚠️  TEMPORARY BOOTSTRAP PATH — one-time escape hatch only.
    // Allows raayed32@gmail.com to log in via their existing User record the very
    // first time, before any AdminUser document exists. On first successful login
    // this branch auto-creates the AdminUser record, so subsequent logins go
    // through the normal path (AdminUser collection). Once AdminUser exists for
    // this email, this branch is never reached again.
    if (email.toLowerCase() !== SUPER_ADMIN_EMAIL) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const regularUser = await User.findOne({ email: SUPER_ADMIN_EMAIL })
    if (!regularUser) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const valid = await bcrypt.compare(password, regularUser.password)
    if (!valid) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    // Auto-create super_admin record on first login
    adminUser = await AdminUser.create({
      email: SUPER_ADMIN_EMAIL,
      name: regularUser.name,
      password: regularUser.password,  // already hashed
      role: 'super_admin',
      isActive: true,
    })
    adminId = adminUser._id.toString()
    name = adminUser.name
    role = 'super_admin'
  } else {
    if (!adminUser.isActive) {
      return Response.json({ error: 'Account deactivated' }, { status: 403 })
    }
    const valid = await bcrypt.compare(password, adminUser.password)
    if (!valid) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    adminId = adminUser._id.toString()
    name = adminUser.name
    role = adminUser.role
    await AdminUser.updateOne({ _id: adminUser._id }, { $set: { lastLoginAt: new Date() } })
  }

  const token = await signAdminToken({ adminId, email: email.toLowerCase(), name, role })

  const res = NextResponse.json({ ok: true, name, role })
  res.cookies.set(COOKIE_NAME, token, getAdminCookieOptions())
  return res
}

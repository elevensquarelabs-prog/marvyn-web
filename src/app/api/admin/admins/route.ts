import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import AdminUser from '@/models/AdminUser'
import { requireAdmin } from '@/lib/admin-auth'
import type { AdminRole } from '@/models/AdminUser'

export async function GET(req: NextRequest) {
  try { await requireAdmin(req, 'super_admin') } catch (res) { return res as Response }
  await connectDB()
  const admins = await AdminUser.find({}).select('-password').sort({ createdAt: -1 }).lean()
  return Response.json({ admins })
}

export async function POST(req: NextRequest) {
  let caller
  try { caller = await requireAdmin(req, 'super_admin') } catch (res) { return res as Response }
  await connectDB()

  const { email, name, password, role } = await req.json()
  if (!email || !name || !password || !role) {
    return Response.json({ error: 'email, name, password, role required' }, { status: 400 })
  }
  const validRoles: AdminRole[] = ['super_admin', 'support', 'billing_viewer']
  if (!validRoles.includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  const existing = await AdminUser.findOne({ email: email.toLowerCase() })
  if (existing) return Response.json({ error: 'Admin with this email already exists' }, { status: 409 })

  const hashed = await bcrypt.hash(password, 10)
  const admin = await AdminUser.create({
    email: email.toLowerCase(),
    name,
    password: hashed,
    role,
    isActive: true,
    createdBy: caller.adminId,
  })

  return Response.json({
    admin: {
      _id: admin._id.toString(),
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
    },
  }, { status: 201 })
}

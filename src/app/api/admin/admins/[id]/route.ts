import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import AdminUser from '@/models/AdminUser'
import type { AdminRole } from '@/models/AdminUser'
import { requireAdmin } from '@/lib/admin-auth'

const VALID_ROLES: AdminRole[] = ['super_admin', 'support', 'billing_viewer']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let caller
  try { caller = await requireAdmin(req, 'super_admin') } catch (res) { return res as Response }
  const { id } = await params
  await connectDB()

  const { action, role } = await req.json()

  if (action === 'deactivate' && id === caller.adminId) {
    return Response.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
  }

  if (action === 'activate') {
    const result = await AdminUser.updateOne({ _id: id }, { $set: { isActive: true } })
    if (result.matchedCount === 0) return Response.json({ error: 'Admin not found' }, { status: 404 })
    return Response.json({ success: true, isActive: true })
  }

  if (action === 'deactivate') {
    const result = await AdminUser.updateOne({ _id: id }, { $set: { isActive: false } })
    if (result.matchedCount === 0) return Response.json({ error: 'Admin not found' }, { status: 404 })
    return Response.json({ success: true, isActive: false })
  }

  if (action === 'change_role') {
    if (!role || !VALID_ROLES.includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 })
    }
    const result = await AdminUser.updateOne({ _id: id }, { $set: { role } })
    if (result.matchedCount === 0) return Response.json({ error: 'Admin not found' }, { status: 404 })
    return Response.json({ success: true, role })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}

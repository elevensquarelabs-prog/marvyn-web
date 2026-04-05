import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import AdminUser from '@/models/AdminUser'
import { requireAdmin } from '@/lib/admin-auth'

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
    await AdminUser.updateOne({ _id: id }, { $set: { isActive: true } })
    return Response.json({ success: true, isActive: true })
  }

  if (action === 'deactivate') {
    await AdminUser.updateOne({ _id: id }, { $set: { isActive: false } })
    return Response.json({ success: true, isActive: false })
  }

  if (action === 'change_role') {
    await AdminUser.updateOne({ _id: id }, { $set: { role } })
    return Response.json({ success: true, role })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}

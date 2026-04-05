import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { connectDB } from '@/lib/mongodb'
import BetaRequest from '@/models/BetaRequest'

export async function GET(req: NextRequest) {
  try { await requireAdmin(req) } catch (r) { return r as Response }
  await connectDB()
  const requests = await BetaRequest.find().sort({ createdAt: -1 }).lean()
  return Response.json({ requests })
}

export async function PATCH(req: NextRequest) {
  try { await requireAdmin(req, 'support') } catch (r) { return r as Response }
  await connectDB()
  const { id, status } = await req.json()
  const updated = await BetaRequest.findByIdAndUpdate(id, { status }, { new: true })
  return Response.json({ request: updated })
}

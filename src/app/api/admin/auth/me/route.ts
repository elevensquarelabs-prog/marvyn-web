import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    return Response.json(admin)
  } catch (res) {
    return res as Response
  }
}

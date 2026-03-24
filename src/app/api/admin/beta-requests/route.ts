import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import BetaRequest from '@/models/BetaRequest'

const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()
  const requests = await BetaRequest.find().sort({ createdAt: -1 }).lean()
  return Response.json({ requests })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()
  const { id, status } = await req.json()
  const updated = await BetaRequest.findByIdAndUpdate(id, { status }, { new: true })
  return Response.json({ request: updated })
}

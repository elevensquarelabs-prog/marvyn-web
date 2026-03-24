import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import BetaRequest from '@/models/BetaRequest'

const ADMIN_EMAILS = ['raayed32@gmail.com']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  await connectDB()
  const requests = await BetaRequest.find().sort({ createdAt: -1 }).lean()
  return Response.json({ requests })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  await connectDB()
  const { id, status } = await req.json()
  const updated = await BetaRequest.findByIdAndUpdate(id, { status }, { new: true })
  return Response.json({ request: updated })
}

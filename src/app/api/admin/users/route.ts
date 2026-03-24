import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'

const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'

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

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()
  const { id, action } = await req.json()

  const status = action === 'revoke' ? 'revoked' : 'trial'
  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: { 'subscription.status': status } }
  )
  return Response.json({ success: true, status })
}

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Alert from '@/models/Alert'
import mongoose from 'mongoose'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)

  const userId = new mongoose.Types.ObjectId(session.user.id)

  const filter: Record<string, unknown> = { userId, dismissed: false }
  if (unreadOnly) filter.read = false

  const [alerts, unreadCount] = await Promise.all([
    Alert.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Alert.countDocuments({ userId, read: false, dismissed: false }),
  ])

  return Response.json({ alerts, unreadCount })
}

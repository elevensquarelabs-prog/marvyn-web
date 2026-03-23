import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import ChatSession from '@/models/ChatSession'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const sessions = await ChatSession.find({ userId: session.user.id })
    .select('_id title updatedAt createdAt')
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean()

  return Response.json({ sessions })
}

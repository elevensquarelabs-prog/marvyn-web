import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import NangoConnection from '@/models/NangoConnection'
import mongoose from 'mongoose'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const connections = await NangoConnection.find({
    userId: new mongoose.Types.ObjectId(session.user.id),
  })
    .select('integration status connectedAt metadata connectionId')
    .lean()

  return Response.json({ connections })
}

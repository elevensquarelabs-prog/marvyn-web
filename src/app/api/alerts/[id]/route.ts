import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Alert from '@/models/Alert'
import mongoose from 'mongoose'

// PATCH /api/alerts/[id] — mark as read
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: 'Invalid ID' }, { status: 400 })
  }

  await connectDB()

  const alert = await Alert.findOneAndUpdate(
    { _id: id, userId: new mongoose.Types.ObjectId(session.user.id) },
    { $set: { read: true } },
    { new: true }
  ).lean()

  if (!alert) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ success: true })
}

// DELETE /api/alerts/[id] — dismiss
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: 'Invalid ID' }, { status: 400 })
  }

  await connectDB()

  const alert = await Alert.findOneAndUpdate(
    { _id: id, userId: new mongoose.Types.ObjectId(session.user.id) },
    { $set: { dismissed: true, read: true } },
    { new: true }
  ).lean()

  if (!alert) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ success: true })
}

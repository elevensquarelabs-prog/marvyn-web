import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import ChatSession from '@/models/ChatSession'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await connectDB()
  const chatSession = await ChatSession.findOne({ _id: id, userId: session.user.id }).lean()
  if (!chatSession) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ session: chatSession })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await connectDB()
  await ChatSession.deleteOne({ _id: id, userId: session.user.id })

  return Response.json({ success: true })
}

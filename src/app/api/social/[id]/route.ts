import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import SocialPost from '@/models/SocialPost'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await connectDB()
  const body = await req.json()
  const post = await SocialPost.findOneAndUpdate(
    { _id: id, userId: session.user.id },
    body,
    { new: true }
  )
  if (!post) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ post })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await connectDB()
  await SocialPost.findOneAndDelete({ _id: id, userId: session.user.id })
  return Response.json({ success: true })
}

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import BlogPost from '@/models/BlogPost'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await connectDB()
  const post = await BlogPost.findOne({ _id: id, userId: session.user.id })
  if (!post) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ post })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await connectDB()
  const body = await req.json()
  const post = await BlogPost.findOneAndUpdate(
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
  await BlogPost.findOneAndDelete({ _id: id, userId: session.user.id })
  return Response.json({ success: true })
}

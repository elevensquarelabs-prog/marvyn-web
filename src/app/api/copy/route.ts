import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CopyAsset from '@/models/CopyAsset'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const assets = await CopyAsset.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  return Response.json({ assets })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()
  const { name, copyType, framework, product, audience, content } = body

  if (!name || !content) {
    return Response.json({ error: 'name and content required' }, { status: 400 })
  }

  const asset = await CopyAsset.create({
    userId: session.user.id,
    name,
    copyType,
    framework,
    product,
    audience,
    content,
  })

  return Response.json({ asset })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  await connectDB()
  await CopyAsset.deleteOne({ _id: id, userId: session.user.id })

  return Response.json({ success: true })
}

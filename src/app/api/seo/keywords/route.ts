import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Keyword from '@/models/Keyword'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const query: Record<string, unknown> = { userId: session.user.id }
  if (status) query.status = status

  const keywords = await Keyword.find(query).sort({ clicks: -1 }).limit(500)
  return Response.json({ keywords })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()

  if (Array.isArray(body.keywords)) {
    const ops = body.keywords.map((kw: { keyword: string }) => ({
      updateOne: {
        filter: { userId: session.user.id, keyword: kw.keyword },
        update: { $setOnInsert: { userId: session.user.id, ...kw } },
        upsert: true,
      },
    }))
    await Keyword.bulkWrite(ops)
    return Response.json({ success: true, count: ops.length })
  }

  const keyword = await Keyword.create({ userId: session.user.id, ...body })
  return Response.json({ keyword }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { id, status } = await req.json()
  const keyword = await Keyword.findOneAndUpdate(
    { _id: id, userId: session.user.id },
    { status },
    { new: true }
  )
  return Response.json({ keyword })
}

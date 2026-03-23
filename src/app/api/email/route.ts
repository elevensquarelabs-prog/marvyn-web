import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import EmailSequence from '@/models/EmailSequence'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const sequences = await EmailSequence.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  return Response.json({ sequences })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()
  const { name, goal, product, audience, emailCount, steps } = body

  if (!name || !steps?.length) {
    return Response.json({ error: 'name and steps required' }, { status: 400 })
  }

  const sequence = await EmailSequence.create({
    userId: session.user.id,
    name,
    goal,
    product,
    audience,
    emailCount,
    steps,
  })

  return Response.json({ sequence })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  await connectDB()
  await EmailSequence.deleteOne({ _id: id, userId: session.user.id })

  return Response.json({ success: true })
}

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import axios from 'axios'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  // Raw driver to bypass Mongoose schema cache
  const doc = await mongoose.connection.db!
    .collection('users')
    .findOne(
      { _id: new mongoose.Types.ObjectId(session.user.id) },
      { projection: { 'connections.searchConsole': 1, 'connections.google': 1 } }
    )

  const connections = (doc as {
    connections?: {
      searchConsole?: { accessToken?: string }
      google?: { accessToken?: string }
    }
  } | null)?.connections

  // Search Console shares the same token as Google
  const accessToken = connections?.searchConsole?.accessToken || connections?.google?.accessToken

  if (!accessToken) {
    return Response.json({ error: 'Google not connected' }, { status: 400 })
  }

  try {
    const res = await axios.get('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const sites = (res.data.siteEntry || []).map((s: { siteUrl: string; permissionLevel: string }) => ({
      url: s.siteUrl,
      permissionLevel: s.permissionLevel,
    }))

    return Response.json({ sites })
  } catch (err) {
    console.error('[google/sites]', err)
    return Response.json({ error: 'Failed to fetch Search Console sites' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { siteUrl } = await req.json()

  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(session.user.id) },
    { $set: { 'connections.searchConsole.siteUrl': siteUrl } }
  )

  return Response.json({ success: true })
}

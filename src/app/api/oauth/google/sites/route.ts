import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import axios from 'axios'
import { getValidGoogleToken } from '@/lib/google-auth'
import User from '@/models/User'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const accessToken = await getValidGoogleToken(session.user.id, 'searchConsole')

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

  await User.updateOne(
    { _id: session.user.id },
    { $set: { 'connections.searchConsole.siteUrl': siteUrl } }
  )

  return Response.json({ success: true })
}

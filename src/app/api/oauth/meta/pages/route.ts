import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import axios from 'axios'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const user = await User.findById(session.user.id)
  const meta = user?.connections?.meta

  if (!meta?.accessToken) {
    return Response.json({ error: 'Meta not connected' }, { status: 400 })
  }

  try {
    const res = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: meta.accessToken,
        fields: 'id,name,access_token,instagram_business_account',
      },
    })

    const pages = (res.data.data || []).map((p: {
      id: string
      name: string
      access_token: string
      instagram_business_account?: { id: string }
    }) => ({
      id: p.id,
      name: p.name,
      accessToken: p.access_token,
      hasInstagram: !!p.instagram_business_account,
      instagramAccountId: p.instagram_business_account?.id,
    }))

    return Response.json({ pages })
  } catch (err) {
    console.error('[meta/pages]', err)
    return Response.json({ error: 'Failed to fetch pages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { pageId, pageName, pageAccessToken, instagramAccountId } = await req.json()

  const update: Record<string, unknown> = {
    'connections.facebook': { pageId, pageName, pageAccessToken, accessToken: pageAccessToken },
  }
  if (instagramAccountId) {
    update['connections.instagram'] = { accountId: instagramAccountId }
  }

  await User.findByIdAndUpdate(session.user.id, update)
  return Response.json({ success: true })
}

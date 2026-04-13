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
        fields: 'id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}',
      },
    })

    const pages = (res.data.data || []).map((p: {
      id: string
      name: string
      access_token: string
      instagram_business_account?: {
        id: string
        username?: string
        name?: string
        profile_picture_url?: string
      }
    }) => ({
      id: p.id,
      name: p.name,
      accessToken: p.access_token,
      hasInstagram: !!p.instagram_business_account,
      instagramAccountId:  p.instagram_business_account?.id,
      instagramUsername:   p.instagram_business_account?.username,
      instagramName:       p.instagram_business_account?.name,
      instagramPictureUrl: p.instagram_business_account?.profile_picture_url,
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
  const { pageId, pageName, pageAccessToken, instagramAccountId, instagramUsername } = await req.json()

  const update: Record<string, unknown> = {
    'connections.facebook': { pageId, pageName, pageAccessToken, accessToken: pageAccessToken },
  }
  if (instagramAccountId) {
    update['connections.instagram'] = { accountId: instagramAccountId, username: instagramUsername ?? '' }
  }

  await User.findByIdAndUpdate(session.user.id, update)
  return Response.json({ success: true })
}

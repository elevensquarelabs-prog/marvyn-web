import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import axios from 'axios'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')

  if (!code || !userId) {
    return Response.redirect(`${BASE_URL()}/settings?error=meta_oauth_failed`)
  }

  try {
    const redirectUri = `${BASE_URL()}/api/oauth/meta/callback`
    const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    })

    const shortLivedToken = tokenRes.data.access_token

    // Exchange short-lived token (~1hr) for long-lived token (~60 days)
    const longTokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    })

    const accessToken = longTokenRes.data.access_token ?? shortLivedToken

    // Get ad accounts
    const accountsRes = await axios.get('https://graph.facebook.com/v21.0/me/adaccounts', {
      params: { access_token: accessToken, fields: 'id,name', limit: 1 },
    })

    const account = accountsRes.data.data?.[0]
    const accountId = account?.id?.replace('act_', '') || ''
    const accountName = account?.name || 'Meta Ads'

    await connectDB()
    await User.findByIdAndUpdate(userId, {
      'connections.meta': { accessToken, accountId, accountName },
    })

    return Response.redirect(`${BASE_URL()}/settings?connected=meta`)
  } catch (err) {
    console.error('[meta/callback]', err)
    return Response.redirect(`${BASE_URL()}/settings?error=meta_oauth_failed`)
  }
}

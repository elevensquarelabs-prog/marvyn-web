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
    return Response.redirect(`${BASE_URL()}/settings?error=linkedin_oauth_failed`)
  }

  try {
    const tokenRes = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${BASE_URL()}/api/oauth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    const accessToken = tokenRes.data.access_token

    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const profileId = profileRes.data.sub
    const profileName = profileRes.data.name || profileRes.data.email || 'LinkedIn User'

    await connectDB()
    await User.findByIdAndUpdate(userId, {
      'connections.linkedin': { accessToken, profileId, profileName },
    })

    return Response.redirect(`${BASE_URL()}/settings?connected=linkedin`)
  } catch (err) {
    console.error('[linkedin/callback]', err)
    return Response.redirect(`${BASE_URL()}/settings?error=linkedin_oauth_failed`)
  }
}

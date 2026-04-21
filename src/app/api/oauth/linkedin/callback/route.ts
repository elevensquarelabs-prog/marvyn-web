import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import axios from 'axios'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const rawState = searchParams.get('state')

  if (!code || !rawState) {
    return Response.redirect(`${BASE_URL()}/settings?error=linkedin_oauth_failed`)
  }

  const [userId, stateFrom] = rawState.split('|')
  const successRedirect = stateFrom === 'onboarding'
    ? `${BASE_URL()}/onboarding/connected?platform=linkedin&status=success`
    : `${BASE_URL()}/settings?connected=linkedin`

  try {
    const tokenRes = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${BASE_URL()}/api/oauth/linkedin/callback`,
        client_id: (process.env.LINKEDIN_CLIENT_ID || '').trim(),
        client_secret: (process.env.LINKEDIN_CLIENT_SECRET || '').trim(),
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    const accessToken = tokenRes.data.access_token

    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const profileId = profileRes.data.sub || profileRes.data.id || 'linkedin-user'
    const profileName = profileRes.data.name || profileRes.data.email || 'LinkedIn User'

    console.log('[linkedin/callback] profileId:', profileId, 'profileName:', profileName, 'userId:', userId)

    await connectDB()
    // Use raw driver to bypass Mongoose strict mode / schema cache issues
    const result = await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          'connections.linkedin.accessToken': accessToken,
          'connections.linkedin.profileId': profileId,
          'connections.linkedin.profileName': profileName,
        },
      }
    )
    console.log('[linkedin/callback] DB update:', result.matchedCount, 'matched,', result.modifiedCount, 'modified')

    return Response.redirect(successRedirect)
  } catch (err) {
    console.error('[linkedin/callback]', err)
    return Response.redirect(`${BASE_URL()}/settings?error=linkedin_oauth_failed`)
  }
}

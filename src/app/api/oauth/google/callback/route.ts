import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import axios from 'axios'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(req: NextRequest) {
  console.log('[Google CB] FULL URL:', req.url)
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const rawState = searchParams.get('state')
  console.log('[Google CB] code:', !!code, 'error:', error, 'state:', rawState)

  if (!code || !rawState) {
    console.log('[Google CB] missing code or state — aborting')
    return Response.redirect(`${BASE_URL()}/settings?error=google_oauth_failed`)
  }

  const [state, stateFrom] = rawState.split('|')
  const successRedirect = stateFrom === 'onboarding'
    ? `${BASE_URL()}/onboarding/connected?platform=google&status=success`
    : `${BASE_URL()}/settings?connected=google`

  try {
    const redirectUri = `${BASE_URL()}/api/oauth/google/callback`
    console.log('[Google CB] exchanging code, redirect_uri:', redirectUri)

    const params = new URLSearchParams()
    params.set('code', code)
    params.set('client_id', (process.env.GOOGLE_CLIENT_ID || '').trim())
    params.set('client_secret', (process.env.GOOGLE_CLIENT_SECRET || '').trim())
    params.set('redirect_uri', redirectUri)
    params.set('grant_type', 'authorization_code')

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    console.log('[Google CB] token status:', tokenRes.status)
    const tokenData = tokenRes.data
    console.log('[Google CB] token data:', JSON.stringify({
      hasAccess: !!tokenData.access_token,
      hasRefresh: !!tokenData.refresh_token,
      error: tokenData.error,
      errorDesc: tokenData.error_description,
    }))

    await connectDB()
    console.log('[Google CB] DB connected, saving to userId:', state)

    const existing = await mongoose.connection.db!.collection('users').findOne(
      { _id: new mongoose.Types.ObjectId(state) },
      { projection: { 'connections.google.refreshToken': 1, 'connections.searchConsole.refreshToken': 1 } }
    ) as {
      connections?: {
        google?: { refreshToken?: string }
        searchConsole?: { refreshToken?: string }
      }
    } | null

    const refreshToken =
      tokenData.refresh_token ||
      existing?.connections?.google?.refreshToken ||
      existing?.connections?.searchConsole?.refreshToken ||
      ''

    const result = await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(state) },
      {
        $set: {
          'connections.google.accessToken': tokenData.access_token,
          'connections.google.refreshToken': refreshToken,
          'connections.google.connectedAt': new Date(),
          'connections.searchConsole.accessToken': tokenData.access_token,
          'connections.searchConsole.refreshToken': refreshToken,
          'connections.searchConsole.connectedAt': new Date(),
        },
      }
    )

    console.log('[Google CB] saved to userId:', state)
    console.log('[Google CB] updateOne result:', JSON.stringify({ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }))
    console.log('[Google CB] redirecting to /settings?connected=google')

    return Response.redirect(successRedirect)
  } catch (err) {
    console.error('[Google CB] ERROR:', err)
    return Response.redirect(`${BASE_URL()}/settings?error=google_oauth_failed`)
  }
}

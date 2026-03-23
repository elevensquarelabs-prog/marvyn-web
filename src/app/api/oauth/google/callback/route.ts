import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import axios from 'axios'

export async function GET(req: NextRequest) {
  console.log('[Google CB] FULL URL:', req.url)
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state')
  console.log('[Google CB] code:', !!code, 'error:', error, 'state:', state)

  if (!code || !state) {
    console.log('[Google CB] missing code or state — aborting')
    return Response.redirect(`${process.env.NEXTAUTH_URL}/settings?error=google_oauth_failed`)
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/oauth/google/callback`
    console.log('[Google CB] exchanging code, redirect_uri:', redirectUri)

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
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

    const result = await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(state) },
      {
        $set: {
          'connections.google.accessToken': tokenData.access_token,
          'connections.google.refreshToken': tokenData.refresh_token,
          'connections.google.connectedAt': new Date(),
          'connections.searchConsole.accessToken': tokenData.access_token,
          'connections.searchConsole.refreshToken': tokenData.refresh_token,
          'connections.searchConsole.connectedAt': new Date(),
        },
      }
    )

    console.log('[Google CB] saved to userId:', state)
    console.log('[Google CB] updateOne result:', JSON.stringify({ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }))
    console.log('[Google CB] redirecting to /settings?connected=google')

    return Response.redirect(`${process.env.NEXTAUTH_URL}/settings?connected=google`)
  } catch (err) {
    console.error('[Google CB] ERROR:', err)
    return Response.redirect(`${process.env.NEXTAUTH_URL}/settings?error=google_oauth_failed`)
  }
}

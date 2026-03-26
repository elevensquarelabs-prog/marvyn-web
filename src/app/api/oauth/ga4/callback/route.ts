import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import axios from 'axios'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return Response.redirect(`${BASE_URL()}/settings?error=ga4_oauth_failed&section=connections`)
  }

  try {
    const redirectUri = `${BASE_URL()}/api/oauth/ga4/callback`
    const params = new URLSearchParams()
    params.set('code', code)
    params.set('client_id', (process.env.GOOGLE_CLIENT_ID || '').trim())
    params.set('client_secret', (process.env.GOOGLE_CLIENT_SECRET || '').trim())
    params.set('redirect_uri', redirectUri)
    params.set('grant_type', 'authorization_code')

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const tokenData = tokenRes.data

    await connectDB()
    const existing = await mongoose.connection.db!.collection('users').findOne(
      { _id: new mongoose.Types.ObjectId(state) },
      { projection: { 'connections.ga4.refreshToken': 1 } }
    ) as { connections?: { ga4?: { refreshToken?: string } } } | null

    const refreshToken = tokenData.refresh_token || existing?.connections?.ga4?.refreshToken || ''
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(state) },
      {
        $set: {
          'connections.ga4.accessToken': tokenData.access_token,
          'connections.ga4.refreshToken': refreshToken,
          'connections.ga4.connectedAt': new Date(),
        },
      }
    )

    return Response.redirect(`${BASE_URL()}/settings?connected=ga4&section=connections`)
  } catch (err) {
    console.error('[GA4 callback] OAuth exchange failed:', err)
    return Response.redirect(`${BASE_URL()}/settings?error=ga4_oauth_failed&section=connections`)
  }
}

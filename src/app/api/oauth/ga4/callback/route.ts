import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import axios from 'axios'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return Response.redirect(`${process.env.NEXTAUTH_URL}/settings?error=ga4_oauth_failed&section=connections`)
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/oauth/ga4/callback`
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    })

    const tokenData = tokenRes.data

    await connectDB()
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(state) },
      {
        $set: {
          'connections.ga4.accessToken': tokenData.access_token,
          'connections.ga4.refreshToken': tokenData.refresh_token,
          'connections.ga4.connectedAt': new Date(),
        },
      }
    )

    return Response.redirect(`${process.env.NEXTAUTH_URL}/settings?connected=ga4&section=connections`)
  } catch (err) {
    console.error('[GA4 callback] OAuth exchange failed:', err)
    return Response.redirect(`${process.env.NEXTAUTH_URL}/settings?error=ga4_oauth_failed&section=connections`)
  }
}

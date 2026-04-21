import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import axios from 'axios'
import { verifyShopifyHmac } from '@/lib/shopify'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()
const SHOPIFY_CLIENT_ID = () => (process.env.SHOPIFY_CLIENT_ID || '').trim()
const SHOPIFY_CLIENT_SECRET = () => (process.env.SHOPIFY_CLIENT_SECRET || '').trim()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const rawState = searchParams.get('state')

  if (!code || !shop || !rawState) {
    console.error('[shopify/callback] missing params', { code: !!code, shop, state: rawState })
    return Response.redirect(`${BASE_URL()}/settings?error=shopify_oauth_failed`)
  }

  // Verify Shopify HMAC signature
  if (!verifyShopifyHmac(searchParams, SHOPIFY_CLIENT_SECRET())) {
    console.error('[shopify/callback] HMAC verification failed')
    return Response.redirect(`${BASE_URL()}/settings?error=shopify_oauth_failed`)
  }

  const [userId, stateFrom] = rawState.split('|')
  const successRedirect = stateFrom === 'onboarding'
    ? `${BASE_URL()}/onboarding/connected?platform=shopify&status=success`
    : `${BASE_URL()}/settings?connected=shopify`

  try {
    // Exchange code for permanent access token
    const tokenRes = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_CLIENT_ID(),
      client_secret: SHOPIFY_CLIENT_SECRET(),
      code,
    })

    const accessToken = tokenRes.data.access_token as string
    if (!accessToken) throw new Error('No access token in response')

    // Fetch shop info to get name + currency
    const shopRes = await axios.get(`https://${shop}/admin/api/2024-04/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    })
    const shopInfo = shopRes.data.shop ?? {}

    await connectDB()
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          'connections.shopify.accessToken': accessToken,
          'connections.shopify.shop': shop,
          'connections.shopify.shopName': shopInfo.name ?? shop,
          'connections.shopify.currency': shopInfo.currency ?? 'USD',
          'connections.shopify.connectedAt': new Date(),
        },
      }
    )

    console.log('[shopify/callback] connected shop:', shop, 'for user:', userId)
    return Response.redirect(successRedirect)
  } catch (err) {
    console.error('[shopify/callback] error:', err)
    return Response.redirect(`${BASE_URL()}/settings?error=shopify_oauth_failed`)
  }
}

import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'

// GDPR mandatory webhook — shop/redact
// Shopify sends this 48 hours after a merchant uninstalls the app,
// requesting deletion of all their store data.
// We remove the Shopify connection record from the user document.
export async function POST(req: NextRequest) {
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
  const secret = (process.env.SHOPIFY_CLIENT_SECRET || '').trim()

  const body = await req.text()

  if (secret && hmacHeader) {
    const crypto = await import('crypto')
    const hash = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')
    if (hash !== hmacHeader) {
      console.warn('[shopify/shop-redact] HMAC mismatch — rejected')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const payload = JSON.parse(body) as {
    shop_id: number
    shop_domain: string
  }

  try {
    await connectDB()
    // Remove the Shopify connection from whichever user had this shop connected
    const result = await mongoose.connection.db!.collection('users').updateOne(
      { 'connections.shopify.shop': payload.shop_domain },
      { $unset: { 'connections.shopify': '' } }
    )
    console.log(
      `[shopify/shop-redact] shop=${payload.shop_domain} matched=${result.matchedCount} modified=${result.modifiedCount}`
    )
  } catch (err) {
    console.error('[shopify/shop-redact] DB error:', err)
    // Still return 200 — Shopify will retry on 5xx, not on app-side errors
  }

  return new Response('OK', { status: 200 })
}

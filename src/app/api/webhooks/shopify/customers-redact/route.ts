import { NextRequest } from 'next/server'
import { verifyShopifyHmac } from '@/lib/shopify'

// GDPR mandatory webhook — customers/redact
// Shopify sends this when a customer requests deletion of their data.
// Marvyn does not store individual customer PII — only aggregated metrics.
// We acknowledge and log the request.
export async function POST(req: NextRequest) {
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
  const secret = (process.env.SHOPIFY_CLIENT_SECRET || '').trim()

  const body = await req.text()

  // Verify the webhook came from Shopify
  if (secret && hmacHeader) {
    const crypto = await import('crypto')
    const hash = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')
    if (hash !== hmacHeader) {
      console.warn('[shopify/customers-redact] HMAC mismatch — rejected')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const payload = JSON.parse(body) as {
    shop_id: number
    shop_domain: string
    customer: { id: number; email: string; phone: string }
    orders_to_redact: number[]
  }

  // Marvyn stores no individual customer PII — only aggregated store-level metrics
  // (repeat rate, geographic distribution, LTV segments). Nothing to delete.
  console.log(
    `[shopify/customers-redact] shop=${payload.shop_domain} customer_id=${payload.customer?.id} — no PII stored, acknowledged`
  )

  return new Response('OK', { status: 200 })
}

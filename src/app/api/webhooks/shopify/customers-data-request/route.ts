import { NextRequest } from 'next/server'

// GDPR mandatory webhook — customers/data_request
// Shopify sends this when a customer requests a copy of their stored data.
// Marvyn stores no individual customer PII — only aggregated store-level metrics.
// We acknowledge and log the request.
export async function POST(req: NextRequest) {
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
  const secret = (process.env.SHOPIFY_CLIENT_SECRET || '').trim()

  const body = await req.text()

  if (secret && hmacHeader) {
    const crypto = await import('crypto')
    const hash = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')
    if (hash !== hmacHeader) {
      console.warn('[shopify/customers-data-request] HMAC mismatch — rejected')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const payload = JSON.parse(body) as {
    shop_id: number
    shop_domain: string
    customer: { id: number; email: string; phone: string }
    orders_requested: number[]
  }

  // Marvyn stores no individual customer PII — only aggregated store-level metrics.
  // There is no customer-specific data to return.
  console.log(
    `[shopify/customers-data-request] shop=${payload.shop_domain} customer_id=${payload.customer?.id} — no PII stored, acknowledged`
  )

  return new Response('OK', { status: 200 })
}

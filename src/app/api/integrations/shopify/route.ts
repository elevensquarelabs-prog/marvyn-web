import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateOAuthState } from '@/lib/oauth-state'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()
const SHOPIFY_CLIENT_ID = () => (process.env.SHOPIFY_CLIENT_ID || '').trim()

const SCOPES = [
  'read_orders',
  'read_products',
  'read_customers',
  'read_checkouts',
  'read_discounts',
  'read_price_rules',
  'read_analytics',
].join(',')

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const shop = searchParams.get('shop')?.trim().toLowerCase()
  const from = searchParams.get('from')

  if (!shop) return Response.json({ error: 'shop parameter required' }, { status: 400 })

  // Normalise — ensure .myshopify.com suffix
  const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`

  // State encodes userId + onboarding context
  const state = generateOAuthState(session.user.id, from ?? undefined)

  const redirectUri = `${BASE_URL()}/api/integrations/shopify/callback`
  const params = new URLSearchParams({
    client_id: SHOPIFY_CLIENT_ID(),
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
    'grant_options[]': 'per-user',
  })

  const authUrl = `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`
  return Response.json({ authUrl })
}

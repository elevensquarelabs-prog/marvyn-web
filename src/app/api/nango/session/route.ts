import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

const VALID_INTEGRATIONS = new Set(['shopify', 'hubspot', 'stripe'])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { integration } = await req.json()
  if (!integration || !VALID_INTEGRATIONS.has(integration)) {
    return Response.json({ error: 'Invalid integration' }, { status: 400 })
  }

  const nangoBase = process.env.NANGO_BASE_URL?.replace(/\/$/, '')
  const nangoKey  = process.env.NANGO_SECRET_KEY
  if (!nangoBase || !nangoKey) {
    return Response.json({ error: 'Nango not configured' }, { status: 500 })
  }

  await connectDB()
  const user = await User.findById(session.user.id).select('email').lean() as { email?: string } | null
  const connectionId = `${integration}_${session.user.id}`

  const res = await fetch(`${nangoBase}/connect/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${nangoKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      end_user: {
        id:    session.user.id,
        email: user?.email ?? '',
      },
      allowed_integrations: [integration],
      connection_id: connectionId,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown')
    console.error('[nango/session] failed:', err)
    return Response.json({ error: 'Failed to create Nango session' }, { status: 502 })
  }

  const data = await res.json()
  return Response.json({ sessionToken: data.data.token })
}

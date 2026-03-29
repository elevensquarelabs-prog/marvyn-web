import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { connectDB } from '@/lib/mongodb'
import NangoConnection from '@/models/NangoConnection'
import mongoose from 'mongoose'

export async function POST(req: NextRequest) {
  const secret = process.env.NANGO_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'Webhook secret not configured' }, { status: 500 })

  const rawBody  = await req.text()
  const signature = req.headers.get('X-Nango-Hmac-Sha256') ?? ''
  const expected  = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  await connectDB()

  // Successful connection created
  if (payload.type === 'auth' && payload.operation === 'creation') {
    const connectionId: string = payload.connectionId
    // connectionId format: `${integration}_${userId}`
    const underscoreIdx = connectionId.indexOf('_')
    const integration   = connectionId.slice(0, underscoreIdx) as 'shopify' | 'hubspot' | 'stripe'
    const userId        = connectionId.slice(underscoreIdx + 1)

    const metadata: Record<string, string> = {}
    if (payload.connectionConfig?.subdomain)        metadata.shopDomain  = payload.connectionConfig.subdomain
    if (payload.connectionConfig?.portalId)         metadata.portalId    = String(payload.connectionConfig.portalId)
    if (payload.providerMetadata?.accountName)      metadata.accountName = payload.providerMetadata.accountName

    await NangoConnection.updateOne(
      { userId: new mongoose.Types.ObjectId(userId), integration },
      {
        $set: {
          connectionId,
          metadata,
          status:      'active',
          connectedAt: new Date(),
          updatedAt:   new Date(),
        },
      },
      { upsert: true },
    )
  }

  // Token refresh failed — mark connection as error
  if (payload.type === 'auth' && (payload.operation === 'refresh_error' || payload.error)) {
    const connectionId: string = payload.connectionId ?? ''
    if (connectionId) {
      const underscoreIdx = connectionId.indexOf('_')
      const integration   = connectionId.slice(0, underscoreIdx)
      const userId        = connectionId.slice(underscoreIdx + 1)
      await NangoConnection.updateOne(
        { userId: new mongoose.Types.ObjectId(userId), integration },
        { $set: { status: 'error', updatedAt: new Date() } },
      )
    }
  }

  return Response.json({ ok: true })
}

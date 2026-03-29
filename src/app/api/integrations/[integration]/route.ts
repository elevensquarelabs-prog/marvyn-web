import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import NangoConnection from '@/models/NangoConnection'
import mongoose from 'mongoose'

const VALID_INTEGRATIONS = new Set(['shopify', 'hubspot', 'stripe'])

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ integration: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { integration } = await params
  if (!VALID_INTEGRATIONS.has(integration)) {
    return Response.json({ error: 'Invalid integration' }, { status: 400 })
  }

  await connectDB()
  const conn = await NangoConnection.findOne({
    userId:      new mongoose.Types.ObjectId(session.user.id),
    integration,
  }).lean()

  if (!conn) return Response.json({ ok: true })

  // Delete from Nango
  const nangoBase = process.env.NANGO_BASE_URL?.replace(/\/$/, '')
  const nangoKey  = process.env.NANGO_SECRET_KEY
  if (nangoBase && nangoKey) {
    await fetch(
      `${nangoBase}/connection/${conn.connectionId}?provider_config_key=${integration}`,
      { method: 'DELETE', headers: { 'Authorization': `Bearer ${nangoKey}` } },
    ).catch(err => console.error('[integrations/delete] Nango delete failed:', err))
  }

  await NangoConnection.deleteOne({
    userId:      new mongoose.Types.ObjectId(session.user.id),
    integration,
  })

  return Response.json({ ok: true })
}

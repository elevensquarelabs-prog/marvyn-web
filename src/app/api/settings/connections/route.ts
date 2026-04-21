import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'

type RawConnections = {
  meta?: { accessToken?: string; accountId?: string; accountName?: string }
  google?: { accessToken?: string; customerId?: string; customerName?: string; connectedAt?: Date }
  searchConsole?: { accessToken?: string; siteUrl?: string; connectedAt?: Date }
  ga4?: { accessToken?: string; propertyId?: string; propertyName?: string; accountName?: string; connectedAt?: Date }
  linkedin?: { accessToken?: string; profileId?: string; profileName?: string; pageId?: string; pageName?: string; adAccountId?: string; adAccountName?: string }
  facebook?: { accessToken?: string; pageId?: string; pageName?: string }
  instagram?: { accountId?: string }
  clarity?: { projectId?: string; apiToken?: string; connectedAt?: Date }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  // Raw MongoDB driver — bypasses Mongoose schema cache and strict-mode issues
  const doc = await mongoose.connection.db!
    .collection('users')
    .findOne(
      { _id: new mongoose.Types.ObjectId(session.user.id) },
      { projection: { connections: 1 } }
    )

  if (!doc) return Response.json({ error: 'Not found' }, { status: 404 })

  const c = (doc as { connections?: RawConnections }).connections || {}
  const safe: Record<string, Record<string, string>> = {}

  if (c.meta?.accountId) {
    safe.meta = { accountId: c.meta.accountId, accountName: c.meta.accountName || '' }
  }
  if (c.google?.accessToken) {
    safe.google = {
      connected: 'true',
      customerId: c.google.customerId || '',
      customerName: c.google.customerName || '',
      connectedAt: c.google.connectedAt ? c.google.connectedAt.toISOString() : '',
    }
  }
  if (c.searchConsole?.accessToken) {
    safe.searchConsole = {
      connected: 'true',
      siteUrl: c.searchConsole.siteUrl || '',
      connectedAt: c.searchConsole.connectedAt ? c.searchConsole.connectedAt.toISOString() : '',
    }
  }
  if (c.ga4?.accessToken) {
    safe.ga4 = {
      connected: 'true',
      propertyId: c.ga4.propertyId || '',
      propertyName: c.ga4.propertyName || '',
      accountName: c.ga4.accountName || '',
      connectedAt: c.ga4.connectedAt ? c.ga4.connectedAt.toISOString() : '',
    }
  }
  if (c.linkedin?.profileId) {
    safe.linkedin = {
      profileId: c.linkedin.profileId,
      profileName: c.linkedin.profileName || '',
      pageId: c.linkedin.pageId || '',
      pageName: c.linkedin.pageName || '',
      adAccountId: c.linkedin.adAccountId || '',
      adAccountName: c.linkedin.adAccountName || '',
    }
  }
  if (c.facebook?.pageId) {
    safe.facebook = { pageId: c.facebook.pageId, pageName: c.facebook.pageName || '' }
  }
  if (c.instagram?.accountId) {
    safe.instagram = { accountId: c.instagram.accountId }
  }
  if (c.clarity?.projectId) {
    safe.clarity = {
      projectId: c.clarity.projectId,
      connectedAt: c.clarity.connectedAt ? c.clarity.connectedAt.toISOString() : '',
    }
  }
  if ((c as Record<string, unknown> & { shopify?: { accessToken?: string; shop?: string; shopName?: string; currency?: string; connectedAt?: Date } }).shopify?.accessToken) {
    const sh = (c as { shopify: { shop?: string; shopName?: string; currency?: string; connectedAt?: Date } }).shopify
    safe.shopify = {
      connected: 'true',
      shop: sh.shop || '',
      shopName: sh.shopName || '',
      currency: sh.currency || '',
      connectedAt: sh.connectedAt ? sh.connectedAt.toISOString() : '',
    }
  }

  return Response.json({ connections: safe })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { platform } = await req.json()
  const validPlatforms = ['meta', 'google', 'searchConsole', 'ga4', 'linkedin', 'facebook', 'instagram']
  if (!validPlatforms.includes(platform)) {
    return Response.json({ error: 'Invalid platform' }, { status: 400 })
  }

  const doc = await mongoose.connection.db!
    .collection('users')
    .findOne(
      { _id: new mongoose.Types.ObjectId(session.user.id) },
      { projection: { connections: 1 } }
    ) as { connections?: RawConnections } | null

  const connections = doc?.connections || {}

  try {
    if (platform === 'google' || platform === 'searchConsole') {
      const token = connections.google?.accessToken || connections.searchConsole?.accessToken
      if (token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      }
    }

    if (platform === 'ga4') {
      const token = connections.ga4?.accessToken
      if (token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      }
    }

    if (platform === 'meta') {
      const token = connections.meta?.accessToken
      if (token) {
        await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(token)}`, {
          method: 'DELETE',
        })
      }
    }
  } catch (err) {
    console.error(`[settings/connections] provider revoke failed for ${platform}:`, err)
  }

  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(session.user.id) },
    { $unset: { [`connections.${platform}`]: '' } }
  )

  return Response.json({ success: true })
}

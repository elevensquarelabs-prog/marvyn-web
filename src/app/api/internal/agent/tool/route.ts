import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import Brand from '@/models/Brand'
import { executeTool, type AgentContext, type RawConnections } from '@/lib/agent/tools'
import NangoConnection from '@/models/NangoConnection'

// All tools the Python agent service is allowed to call
const ALLOWED_TOOLS = new Set([
  'get_brand_context',
  'get_seo_report',
  'run_seo_audit',
  'get_keyword_rankings',
  'get_analytics_summary',
  'get_competitor_insights',
  'run_competitor_analysis',
  'get_meta_ads_performance',
  'get_google_ads_performance',
  'get_ga4_analytics',
  'get_linkedin_analytics',
  'get_clarity_insights',
  'get_content_calendar',
  'generate_blog_post',
  'generate_social_post',
  'publish_post',
  'schedule_post',
  'update_brand_info',
  'get_alerts',
  'dismiss_alert',
])

export async function POST(req: NextRequest) {
  const secret = process.env.AGENT_SHARED_SECRET?.trim()
  if (!secret) {
    return Response.json({ error: 'Agent bridge not configured' }, { status: 500 })
  }
  if (req.headers.get('x-marvyn-agent-secret')?.trim() !== secret) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as {
    userId?: string
    tool?: string
    args?: Record<string, unknown>
  } | null

  if (!body?.userId || !body.tool || !ALLOWED_TOOLS.has(body.tool)) {
    return Response.json({ error: 'Invalid payload' }, { status: 400 })
  }

  try {
    await connectDB()

    const [brand, rawUser, nangoConns] = await Promise.all([
      Brand.findOne({ userId: body.userId }).lean() as Promise<Record<string, unknown> | null>,
      mongoose.connection.db!
        .collection('users')
        .findOne(
          { _id: new mongoose.Types.ObjectId(body.userId) },
          { projection: { connections: 1 } }
        ) as Promise<{ connections?: RawConnections } | null>,
      NangoConnection.find({ userId: body.userId, status: 'active' }).lean(),
    ])

    const CAPABILITIES: Record<string, string[]> = {
      shopify: ['orders', 'revenue', 'refunds', 'aov'],
      hubspot: ['deals', 'pipeline', 'crm_revenue'],
      stripe:  ['charges', 'subscriptions', 'mrr', 'revenue'],
    }

    const context: AgentContext = {
      userId: body.userId,
      brand,
      connections: rawUser?.connections || {},
      integrations: nangoConns.map(c => ({
        integration:  c.integration,
        connectionId: c.connectionId,
        metadata:     (c.metadata ?? {}) as Record<string, string>,
        capabilities: CAPABILITIES[c.integration] ?? [],
      })),
    }

    const result = await executeTool(body.tool, body.args || {}, context)
    return Response.json(result)
  } catch (error) {
    console.error('[internal/agent/tool] failed:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Tool execution failed' },
      { status: 500 }
    )
  }
}

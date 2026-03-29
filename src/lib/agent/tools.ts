import { connectDB } from '@/lib/mongodb'
import { llm } from '@/lib/llm'
import { skills } from '@/lib/skills'
import { buildCacheKey, getCachedIntegrationResult, setCachedIntegrationResult } from '@/lib/integration-cache'
import { nangoGet } from '@/lib/nango'
import Brand from '@/models/Brand'
import BlogPost from '@/models/BlogPost'
import SocialPost from '@/models/SocialPost'
import SEOAudit from '@/models/SEOAudit'
import Keyword from '@/models/Keyword'
import mongoose from 'mongoose'
import axios from 'axios'
import { getAdsInsightsForUser } from '@/lib/ads-performance'
import { publishToLinkedIn, publishToFacebook, publishToInstagram } from '@/lib/social-publish'
import { getValidGoogleToken } from '@/lib/google-auth'

export interface RawConnections {
  meta?: { accessToken?: string; accountId?: string; accountName?: string }
  google?: { accessToken?: string; refreshToken?: string; customerId?: string }
  searchConsole?: { accessToken?: string; refreshToken?: string; siteUrl?: string }
  ga4?: { accessToken?: string; refreshToken?: string; propertyId?: string; propertyName?: string; accountName?: string; connectedAt?: Date }
  linkedin?: { accessToken?: string; profileId?: string; profileName?: string; pageId?: string; pageName?: string; adAccountId?: string }
  facebook?: { pageAccessToken?: string; accessToken?: string; pageId?: string; pageName?: string }
  instagram?: { accountId?: string }
  clarity?: { projectId?: string; apiToken?: string; clarityCache?: { data?: Record<string, unknown>; cachedAt?: Date } }
}

export interface NangoIntegrationContext {
  integration: string
  connectionId: string
  metadata: Record<string, string>
  capabilities: string[]
}

export interface AgentContext {
  userId: string
  brand: Record<string, unknown> | null
  connections: RawConnections
  integrations: NangoIntegrationContext[]
}

export interface ToolResult {
  summary: string   // shown to user in UI
  content: string   // full data returned to LLM
}

// ── Tool Definitions (OpenAI function-calling format) ─────────────────────────

export const TOOL_DEFINITIONS = [
  // ── Read tools ────────────────────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'get_brand_context',
      description: 'Get full brand details: name, product, audience, tone, USP, website, currency, connected platforms, and competitor list. Call this when you need business model, audience, or tone context to interpret other data correctly — or before generating any content. Usually the first call when brand context is missing.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_seo_report',
      description: 'Get the latest SEO audit: score, issues by severity, keyword data, and AI recommendations. ALWAYS call this first for any SEO question — never skip to other SEO tools without calling this first. If the score is below 70 or issue count is high, follow up with get_keyword_rankings to check if positions are dropping.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_seo_audit',
      description: 'Check if a fresh SEO audit is needed and return current audit status. Call this ONLY if get_seo_report returns stale data (older than 7 days) or the user explicitly asks to run a new audit. Do not call this as a first step — always call get_seo_report first.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Domain or URL to audit (optional — defaults to brand website)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_keyword_rankings',
      description: 'Get GSC keyword rankings: clicks, impressions, CTR, and average position. Call this AFTER get_seo_report when: (a) SEO score is below 70, (b) the user asks about specific keyword positions, or (c) organic traffic appears to be dropping. Do not call this without first calling get_seo_report.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of keywords to return (default 25, max 100)' },
          sort_by: { type: 'string', enum: ['clicks', 'impressions', 'position'], description: 'Sort keywords by this metric (default: clicks)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_analytics_summary',
      description: 'Get organic search performance: GSC click data, keyword traffic trends, and content output stats. Call this first for questions about organic traffic, content performance, or what is driving site visits. If results show traffic is flat or dropping, follow up with get_competitor_insights to find gaps.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_competitor_insights',
      description: 'Get competitor intelligence: tracked competitor domains, their organic traffic, keyword counts, and comparison to the user\'s site. Call this AFTER get_analytics_summary or get_seo_report when: (a) user asks what content to create, (b) organic traffic is flat or dropping, or (c) user asks how they compare to competitors.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_competitor_analysis',
      description: 'Deep competitor SEO comparison: keyword gaps, traffic differences, and content opportunities. Call this when the user explicitly asks for competitor analysis or when get_seo_report shows the user is losing ground to specific competitors. More detailed and slower than get_competitor_insights.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_meta_ads_performance',
      description: 'Get Meta (Facebook/Instagram) Ads performance: total spend, clicks, impressions, ROAS, CPM, CTR, and top campaigns. Call this FIRST for any Meta or Facebook or Instagram ads question. After reviewing results: if ROAS is below 2x or conversions are lower than expected, call get_ga4_analytics next to check whether the problem is traffic quality or landing page conversion.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to look back (default 30)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_google_ads_performance',
      description: 'Get Google Ads performance: total spend, clicks, impressions, conversions, ROAS, and top campaigns. Call this FIRST for any Google Ads question. After reviewing results: if ROAS is below 2x or conversion volume is low, call get_ga4_analytics next to determine whether the problem is at the ad level or the landing page level.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to look back (default 30)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_linkedin_analytics',
      description: 'Get LinkedIn post activity: published posts, recent content, and engagement summary. Call this for LinkedIn-specific content performance questions or when the user asks about their LinkedIn presence.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_ga4_analytics',
      description: 'Get GA4 session and conversion data: sessions, users, engaged sessions, conversions, bounce rate by channel and landing page. Call this ONLY AFTER get_meta_ads_performance or get_google_ads_performance, and ONLY when: ROAS is below target, conversion volume is low, or you need to determine if the problem is traffic quality vs landing page performance. After reviewing results: if bounce rate is above 60% or landing page conversion rate is very low, call get_clarity_insights to find the specific UX friction. Do NOT call this for pure ad spend or budget questions.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to look back (default 30)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_clarity_insights',
      description: 'Get Microsoft Clarity UX behavior data: scroll depth, rage clicks, dead clicks, session counts by device and browser, plus AI UX analysis. Call this ONLY AFTER get_ga4_analytics, and ONLY when GA4 shows: bounce rate above 60%, low average engagement time, or poor on-page conversion rate. Use it to identify the specific UX friction (e.g. rage clicks on CTA, low scroll depth on landing page) that explains why paid traffic is not converting. Do NOT call this for general questions or without GA4 data first.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_content_calendar',
      description: 'Get the content calendar: scheduled posts, drafts pending approval, and recently published content across blog and social. Call this when the user asks about their content pipeline, what is scheduled, or what has been published recently.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  // ── Generate tools ────────────────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'generate_blog_post',
      description: 'Generate a complete SEO-optimized blog post draft and save it for the user to review. Returns the title and ID of the created draft. When generating based on SEO data, use the target keyword from get_keyword_rankings or get_seo_report gaps.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic or working title for the blog post' },
          target_keyword: { type: 'string', description: 'Primary SEO keyword to optimize for' },
          tone: { type: 'string', description: 'Writing tone: professional, casual, educational, conversational, authoritative' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_social_post',
      description: 'Generate a social media post draft and save it for review. Returns a preview and the post ID. Call get_brand_context first if you do not already have brand tone and audience context.',
      parameters: {
        type: 'object',
        properties: {
          platform: { type: 'string', enum: ['linkedin', 'facebook', 'instagram'], description: 'Target social platform' },
          topic: { type: 'string', description: 'What to write about' },
          tone: { type: 'string', description: 'Tone: professional, casual, promotional, educational, storytelling' },
        },
        required: ['platform', 'topic'],
      },
    },
  },
  // ── Action tools ──────────────────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'publish_post',
      description: 'Publish a saved social media post immediately to LinkedIn, Facebook, or Instagram. Requires the post ID from generate_social_post or get_content_calendar. Always confirm the post exists before calling this.',
      parameters: {
        type: 'object',
        properties: {
          post_id: { type: 'string', description: 'MongoDB ID of the draft or pending post to publish' },
        },
        required: ['post_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'schedule_post',
      description: 'Schedule a saved social media post to be published at a specific date and time. Requires the post ID from generate_social_post or get_content_calendar.',
      parameters: {
        type: 'object',
        properties: {
          post_id: { type: 'string', description: 'MongoDB ID of the draft post to schedule' },
          scheduled_for: { type: 'string', description: 'ISO 8601 datetime for when to publish, e.g. "2026-04-01T09:00:00Z"' },
        },
        required: ['post_id', 'scheduled_for'],
      },
    },
  },
  // ── Alert tools ───────────────────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'get_alerts',
      description: 'Get the user\'s unread proactive alerts: traffic drops, content gaps, weekly digests, and budget anomalies. Call this when the user asks about notifications, alerts, or what Marvyn has automatically detected.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'dismiss_alert',
      description: 'Mark an alert as read and dismissed after the user has acknowledged it.',
      parameters: {
        type: 'object',
        properties: {
          alert_id: { type: 'string', description: 'MongoDB ID of the alert to dismiss' },
        },
        required: ['alert_id'],
      },
    },
  },
  // ── Update tools ──────────────────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'update_brand_info',
      description: 'Update a brand profile field. Call this when the user explicitly asks to change their brand name, product description, target audience, tone, USP, website URL, words to avoid, or currency.',
      parameters: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            enum: ['name', 'product', 'audience', 'tone', 'usp', 'websiteUrl', 'avoidWords', 'currency'],
            description: 'Which brand field to update',
          },
          value: { type: 'string', description: 'New value for the field' },
        },
        required: ['field', 'value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_shopify_orders',
      description: 'Fetch recent Shopify orders: order IDs, totals, status, source, line items. Call this when the user asks about actual sales, real conversion volume, or wants to cross-reference ad-reported conversions against real Shopify orders. Requires Shopify to be connected.',
      parameters: {
        type: 'object',
        properties: {
          days:   { type: 'number', description: 'Look back N days (default 30, max 90)' },
          limit:  { type: 'number', description: 'Number of orders to return (default 50, max 250)' },
          status: { type: 'string', enum: ['any', 'open', 'closed', 'cancelled'], description: 'Order status filter (default: any)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_shopify_revenue',
      description: 'Fetch aggregated Shopify revenue summary: total revenue, AOV, order count. Call this when the user asks about total sales, average order value, or revenue trends. Use instead of get_shopify_orders when aggregate numbers are sufficient.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Look back N days (default 30, max 90)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_hubspot_deals',
      description: 'Fetch open HubSpot deals: deal name, value, pipeline stage, close date. Call this when the user asks about pipeline health, deal flow, CRM revenue potential, or wants to understand their sales funnel performance.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of deals to return (default 50, max 100)' },
          stage: { type: 'string', description: 'Filter by pipeline stage name (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_stripe_revenue',
      description: 'Fetch Stripe revenue data: MRR estimate, total charges, subscription count, recent transactions. Call this when the user asks about recurring revenue, subscription health, cash collection, or payment trends.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Look back N days for charges (default 30, max 90)' },
        },
        required: [],
      },
    },
  },
]

export const TOOL_LABELS: Record<string, string> = {
  get_brand_context: 'Loading brand context…',
  get_seo_report: 'Reading SEO report…',
  run_seo_audit: 'Checking SEO audit status…',
  get_keyword_rankings: 'Fetching keyword rankings…',
  get_analytics_summary: 'Fetching analytics…',
  get_competitor_insights: 'Analyzing competitors…',
  run_competitor_analysis: 'Running competitor analysis…',
  get_meta_ads_performance: 'Fetching Meta Ads data…',
  get_google_ads_performance: 'Fetching Google Ads data…',
  get_ga4_analytics: 'Fetching GA4 analytics…',
  get_linkedin_analytics: 'Loading LinkedIn activity…',
  get_clarity_insights: 'Reading Clarity insights…',
  get_content_calendar: 'Loading content calendar…',
  generate_blog_post: 'Writing blog post…',
  generate_social_post: 'Writing social post…',
  publish_post: 'Publishing post…',
  schedule_post: 'Scheduling post…',
  update_brand_info: 'Updating brand profile…',
  get_alerts: 'Checking alerts…',
  dismiss_alert: 'Dismissing alert…',
  get_shopify_orders:  'Fetching Shopify orders…',
  get_shopify_revenue: 'Fetching Shopify revenue…',
  get_hubspot_deals:   'Fetching HubSpot deals…',
  get_stripe_revenue:  'Fetching Stripe revenue…',
}

// ── Tool Executors ─────────────────────────────────────────────────────────────

async function get_brand_context(context: AgentContext): Promise<ToolResult> {
  await connectDB()
  const brand = context.brand

  if (!brand) {
    return { summary: 'No brand profile set up yet.', content: 'No brand data. Suggest user fills in brand details in Settings.' }
  }

  const conn = context.connections
  const platforms = [
    conn.meta?.accountId ? `Meta Ads (${conn.meta.accountName || conn.meta.accountId})` : null,
    conn.google?.customerId ? 'Google Ads' : null,
    conn.searchConsole?.siteUrl ? `Search Console (${conn.searchConsole.siteUrl})` : null,
    conn.linkedin?.profileId ? `LinkedIn (${conn.linkedin.profileName || ''})` : null,
    conn.facebook?.pageId ? `Facebook (${conn.facebook.pageName || ''})` : null,
  ].filter(Boolean)

  const summary = `Brand: ${brand.name} | Product: ${brand.product} | Audience: ${brand.audience} | Platforms: ${platforms.length > 0 ? platforms.join(', ') : 'none connected'}`

  return {
    summary,
    content: JSON.stringify({
      name: brand.name,
      product: brand.product,
      audience: brand.audience,
      tone: brand.tone,
      usp: brand.usp,
      websiteUrl: brand.websiteUrl,
      currency: brand.currency,
      avoidWords: brand.avoidWords,
      competitors: (brand.competitors as Array<{ url: string; name?: string }> || []).map(c => ({ url: c.url, name: c.name })),
      connectedPlatforms: platforms,
    }),
  }
}

async function get_seo_report(context: AgentContext): Promise<ToolResult> {
  await connectDB()
  const audit = await SEOAudit.findOne({ userId: context.userId }).lean() as Record<string, unknown> | null

  if (!audit) {
    return {
      summary: 'No SEO audit found — run an audit from the SEO workspace first.',
      content: 'No audit data. Suggest the user navigate to SEO > Run Audit.',
    }
  }

  const issues = (audit.issues as Array<{ severity: string; title: string }> || []).slice(0, 8)
  const actions = (audit.aiActions as Array<{ title: string; priority: string; done: boolean }> || [])
    .filter(a => !a.done).slice(0, 5)
  const competitors = (audit.competitors as Array<{ domain: string; organicTraffic?: number; organicKeywords?: number }> || []).slice(0, 5)
  const performance = audit.performance as Record<string, unknown> | undefined

  const summary = `SEO score: ${audit.score}/100 | ${audit.criticalCount} critical, ${audit.warningCount} warnings | Organic traffic: ${audit.organicTraffic ?? 'unknown'} | Keywords: ${audit.organicKeywords ?? 'unknown'}`

  return {
    summary,
    content: JSON.stringify({
      score: audit.score,
      domain: audit.domain,
      location: audit.location,
      criticalCount: audit.criticalCount,
      warningCount: audit.warningCount,
      passedCount: audit.passedCount,
      organicTraffic: audit.organicTraffic,
      organicKeywords: audit.organicKeywords,
      trafficSource: audit.trafficSource,
      performance: { score: performance?.score, lcp: performance?.lcp, cls: performance?.cls, tbt: performance?.tbt },
      pageData: {
        title: (audit.pageData as Record<string, unknown>)?.title,
        h1: (audit.pageData as Record<string, unknown>)?.h1,
        description: (audit.pageData as Record<string, unknown>)?.description,
      },
      topIssues: issues,
      pendingActions: actions,
      competitors: competitors.map(c => ({ domain: c.domain, organicTraffic: c.organicTraffic, organicKeywords: c.organicKeywords })),
      auditDate: audit.createdAt,
    }),
  }
}

async function run_seo_audit(args: { url?: string }, context: AgentContext): Promise<ToolResult> {
  await connectDB()
  const audit = await SEOAudit.findOne({ userId: context.userId }, { score: 1, domain: 1, createdAt: 1, status: 1 }).lean() as Record<string, unknown> | null

  const targetUrl = args.url || (context.brand?.websiteUrl as string) || null

  if (!audit) {
    return {
      summary: 'No audit on record.',
      content: JSON.stringify({
        hasAudit: false,
        message: `No SEO audit found${targetUrl ? ` for ${targetUrl}` : ''}. Go to SEO workspace and click "Run Audit" to run the first audit.`,
        targetUrl,
      }),
    }
  }

  const auditDate = new Date(audit.createdAt as string)
  const daysSince = Math.floor((Date.now() - auditDate.getTime()) / 86400000)
  const isStale = daysSince > 7

  return {
    summary: `Last audit: ${audit.domain} scored ${audit.score}/100 (${daysSince}d ago)${isStale ? ' — stale, suggest re-run' : ''}`,
    content: JSON.stringify({
      hasAudit: true,
      domain: audit.domain,
      score: audit.score,
      auditDate: audit.createdAt,
      daysSince,
      isStale,
      message: isStale
        ? `Audit is ${daysSince} days old. To get fresh data, go to the SEO workspace and click "Run Audit". I can analyze the existing results in the meantime.`
        : `Audit is current (${daysSince} days old). Use get_seo_report to see full details.`,
    }),
  }
}

async function get_keyword_rankings(
  args: { limit?: number; sort_by?: string },
  context: AgentContext
): Promise<ToolResult> {
  await connectDB()

  const limit = Math.min(args.limit || 25, 100)
  const sortField = args.sort_by || 'clicks'
  const sortFields: Record<string, string> = {
    clicks: '-clicks',
    impressions: '-impressions',
    position: 'currentPosition',
  }
  const sort = sortFields[sortField] || '-clicks'

  const keywords = await Keyword.find({ userId: context.userId })
    .sort(sort)
    .limit(limit)
    .lean() as Array<{ keyword: string; clicks?: number; impressions?: number; currentPosition?: number; ctr?: number }>

  if (keywords.length === 0) {
    return {
      summary: 'No keyword data — connect Google Search Console and sync to see rankings.',
      content: 'No keywords synced. Suggest user connects Search Console in Settings and runs a sync.',
    }
  }

  const totalClicks = keywords.reduce((s, k) => s + (k.clicks || 0), 0)
  const avgPosition = keywords.reduce((s, k) => s + (k.currentPosition || 0), 0) / keywords.length

  const summary = `${keywords.length} keywords | Total clicks: ${totalClicks} | Avg position: ${avgPosition.toFixed(1)} | Top: "${keywords[0]?.keyword}" (${keywords[0]?.clicks || 0} clicks)`

  return {
    summary,
    content: JSON.stringify({
      count: keywords.length,
      totalClicks,
      avgPosition: Math.round(avgPosition * 10) / 10,
      sortedBy: sortField,
      keywords: keywords.map(k => ({
        keyword: k.keyword,
        clicks: k.clicks || 0,
        impressions: k.impressions || 0,
        position: k.currentPosition || null,
        ctr: k.ctr || null,
      })),
    }),
  }
}

async function get_analytics_summary(context: AgentContext): Promise<ToolResult> {
  await connectDB()

  const uid = new mongoose.Types.ObjectId(context.userId)

  const [keywords, blogCounts, socialCounts] = await Promise.all([
    Keyword.find({ userId: context.userId }).sort({ clicks: -1 }).limit(10).lean() as Promise<Array<{ keyword: string; clicks?: number; impressions?: number; currentPosition?: number; ctr?: number }>>,
    BlogPost.aggregate([
      { $match: { userId: uid } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).catch(() => []),
    SocialPost.aggregate([
      { $match: { userId: uid } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).catch(() => []),
  ])

  const totalClicks = keywords.reduce((s, k) => s + (k.clicks || 0), 0)
  const totalImpressions = keywords.reduce((s, k) => s + (k.impressions || 0), 0)
  const blogMap = Object.fromEntries((blogCounts as { _id: string; count: number }[]).map(b => [b._id, b.count]))
  const socialMap = Object.fromEntries((socialCounts as { _id: string; count: number }[]).map(s => [s._id, s.count]))

  const summary = `${keywords.length} keywords tracked | ${totalClicks} GSC clicks | Blog: ${blogMap.published || 0} published, ${blogMap.pending_approval || 0} pending | Social: ${socialMap.published || 0} published, ${socialMap.pending_approval || 0} pending`

  return {
    summary,
    content: JSON.stringify({
      keywords: { total: keywords.length, totalClicks, totalImpressions, topKeywords: keywords.slice(0, 10) },
      content: {
        blog: { published: blogMap.published || 0, pending: blogMap.pending_approval || 0, scheduled: blogMap.scheduled || 0 },
        social: { published: socialMap.published || 0, pending: socialMap.pending_approval || 0, scheduled: socialMap.scheduled || 0 },
      },
    }),
  }
}

async function get_competitor_insights(context: AgentContext): Promise<ToolResult> {
  await connectDB()

  const [brand, audit] = await Promise.all([
    Brand.findOne({ userId: context.userId }).lean() as Promise<Record<string, unknown> | null>,
    SEOAudit.findOne({ userId: context.userId }, { competitors: 1, domain: 1, score: 1 }).lean() as Promise<Record<string, unknown> | null>,
  ])

  const brandCompetitors = (brand?.competitors as Array<{ url: string; name?: string; positioning?: string }> || [])
  const auditCompetitors = (audit?.competitors as Array<{ domain: string; organicTraffic?: number; organicKeywords?: number }> || [])

  if (brandCompetitors.length === 0 && auditCompetitors.length === 0) {
    return { summary: 'No competitors tracked. Run an SEO audit to auto-discover competitors.', content: 'No competitor data.' }
  }

  const merged = auditCompetitors.map(ac => ({
    domain: ac.domain,
    organicTraffic: ac.organicTraffic,
    organicKeywords: ac.organicKeywords,
    positioning: brandCompetitors.find(bc => bc.url?.includes(ac.domain))?.positioning,
  }))

  const summary = `${merged.length} competitors tracked. Top: ${merged.slice(0, 3).map(c => c.domain).join(', ')}`

  return {
    summary,
    content: JSON.stringify({
      userDomain: audit?.domain,
      userScore: audit?.score,
      competitors: merged,
      brandCompetitors: brandCompetitors.map(c => ({ url: c.url, name: c.name, positioning: c.positioning })),
    }),
  }
}

async function run_competitor_analysis(context: AgentContext): Promise<ToolResult> {
  await connectDB()

  const [brand, audit] = await Promise.all([
    Brand.findOne({ userId: context.userId }).lean() as Promise<Record<string, unknown> | null>,
    SEOAudit.findOne({ userId: context.userId }).lean() as Promise<Record<string, unknown> | null>,
  ])

  if (!audit) {
    return { summary: 'No SEO audit — run an audit first to discover competitors.', content: 'No audit data for competitor analysis.' }
  }

  const auditCompetitors = (audit.competitors as Array<{ domain: string; organicTraffic?: number; organicKeywords?: number }> || [])
  const brandCompetitors = (brand?.competitors as Array<{ url: string; name?: string; positioning?: string }> || [])
  const competitorAnalysis = (brand as { competitorAnalysis?: Record<string, unknown> })?.competitorAnalysis

  const userDomain = audit.domain as string
  const userScore = audit.score as number
  const userTraffic = audit.organicTraffic as number | null

  // Merge audit + brand competitor data
  const competitors = auditCompetitors.map(ac => {
    const brand_entry = brandCompetitors.find(bc => bc.url?.includes(ac.domain))
    return {
      domain: ac.domain,
      name: brand_entry?.name || ac.domain,
      organicTraffic: ac.organicTraffic,
      organicKeywords: ac.organicKeywords,
      positioning: brand_entry?.positioning,
      trafficVsYou: userTraffic && ac.organicTraffic ? (ac.organicTraffic > userTraffic ? 'ahead' : 'behind') : 'unknown',
    }
  })

  const summary = `Analyzed ${competitors.length} competitors vs ${userDomain} (score ${userScore}/100)`

  return {
    summary,
    content: JSON.stringify({
      yourSite: {
        domain: userDomain,
        seoScore: userScore,
        organicTraffic: userTraffic,
        organicKeywords: audit.organicKeywords,
        trafficSource: audit.trafficSource,
      },
      competitors,
      savedAnalysis: competitorAnalysis ? {
        analyzedAt: competitorAnalysis.analyzedAt,
        summary: competitorAnalysis.summary,
        opportunities: competitorAnalysis.opportunities,
      } : null,
      note: competitors.length === 0
        ? 'No competitors found in audit data. Run a fresh SEO audit to auto-discover SERP competitors.'
        : `Comparing your site to ${competitors.length} tracked competitors.`,
    }),
  }
}

async function get_meta_ads_performance(
  args: { days?: number },
  context: AgentContext
): Promise<ToolResult> {
  const meta = context.connections.meta
  if (!meta?.accessToken || !meta?.accountId) {
    return {
      summary: 'Meta Ads not connected.',
      content: JSON.stringify({ connected: false, message: 'Connect Meta Ads in Settings > Connections to see ad performance.' }),
    }
  }

  const days = args.days || 30
  const until = new Date()
  until.setDate(until.getDate() - 1)
  const since = new Date(until)
  since.setDate(since.getDate() - days + 1)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  try {
    const accountId = String(meta.accountId).replace(/^act_/, '')
    const fields = 'spend,impressions,clicks,ctr,actions,action_values,purchase_roas,campaign_name,campaign_id'
    const timeRange = JSON.stringify({ since: fmt(since), until: fmt(until) })

    const res = await axios.get(`https://graph.facebook.com/v21.0/act_${accountId}/insights`, {
      params: { access_token: meta.accessToken, fields, level: 'campaign', time_range: timeRange, limit: 200 },
    })

    const rows = res.data?.data || []
    const CONV_TYPES = ['purchase', 'omni_purchase', 'complete_registration', 'lead']
    const REV_TYPES = ['purchase', 'omni_purchase']
    const pickActions = (arr: Array<{ action_type: string; value: string }> | undefined, types: string[]) =>
      (arr ?? []).filter(a => types.includes(a.action_type)).reduce((s, a) => s + parseFloat(a.value || '0'), 0)

    type CampAgg = { name: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number }
    const aggMap = new Map<string, CampAgg>()
    for (const row of rows) {
      const cid = row.campaign_id as string
      const agg = aggMap.get(cid) ?? { name: row.campaign_name as string, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
      agg.spend += parseFloat(row.spend || '0')
      agg.impressions += parseInt(row.impressions || '0')
      agg.clicks += parseInt(row.clicks || '0')
      agg.conversions += pickActions(row.actions, CONV_TYPES)
      agg.revenue += pickActions(row.action_values, REV_TYPES)
      aggMap.set(cid, agg)
    }

    const campaigns = Array.from(aggMap.values())
    const totals = campaigns.reduce((t, c) => ({
      spend: t.spend + c.spend,
      impressions: t.impressions + c.impressions,
      clicks: t.clicks + c.clicks,
      conversions: t.conversions + c.conversions,
      revenue: t.revenue + c.revenue,
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 })

    const roas = totals.spend > 0 && totals.revenue > 0 ? totals.revenue / totals.spend : null
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : null

    const summary = `Meta Ads (${days}d): Spend ₹${totals.spend.toFixed(0)} | ${totals.clicks} clicks | ROAS ${roas ? roas.toFixed(2) + 'x' : 'N/A'} | ${campaigns.length} campaigns`

    return {
      summary,
      content: JSON.stringify({
        dateRange: { since: fmt(since), until: fmt(until), days },
        totals: { ...totals, roas, ctr: Math.round(ctr * 100) / 100, cpa },
        campaigns: campaigns
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 10)
          .map(c => ({
            ...c,
            roas: c.spend > 0 && c.revenue > 0 ? c.revenue / c.spend : null,
            ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
          })),
        accountId: meta.accountId,
        accountName: meta.accountName || '',
      }),
    }
  } catch (err) {
    const msg = axios.isAxiosError(err)
      ? JSON.stringify(err.response?.data?.error || err.message)
      : String(err)
    console.error('[tool:get_meta_ads_performance]', msg)
    return {
      summary: `Meta Ads fetch failed: ${msg.slice(0, 120)}`,
      content: JSON.stringify({ error: msg, connected: true, accountId: meta.accountId }),
    }
  }
}

async function get_google_ads_performance(
  args: { days?: number },
  context: AgentContext
): Promise<ToolResult> {
  if (!context.connections.google?.customerId) {
    return {
      summary: 'Google Ads not connected.',
      content: JSON.stringify({ connected: false, message: 'Connect Google Ads in Settings > Connections to see ad performance.' }),
    }
  }

  const days = args.days || 30

  try {
    const result = await getAdsInsightsForUser({ userId: context.userId, days })
    const totals = result.platformBreakdown.google
    const googleCampaigns = result.campaigns.filter(c => c.platform === 'google')
    const roas = totals.spend > 0 && totals.revenue > 0 ? totals.revenue / totals.spend : null
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : null

    const summary = `Google Ads (${days}d): Spend ₹${totals.spend.toFixed(0)} | ${totals.clicks} clicks | ROAS ${roas ? roas.toFixed(2) + 'x' : 'N/A'} | ${googleCampaigns.length} campaigns`

    return {
      summary,
      content: JSON.stringify({
        totals: { ...totals, roas, ctr: Math.round(ctr * 100) / 100, cpa },
        campaigns: googleCampaigns.slice(0, 10).map(c => ({
          ...c,
          roas: c.spend > 0 && c.revenue > 0 ? c.revenue / c.spend : null,
          ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        })),
        customerId: context.connections.google?.customerId,
        errors: result.errors,
      }),
    }
  } catch (err) {
    const e = err as { response?: { data?: unknown }; message?: string }
    const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message
    const isDevToken = detail?.includes('DEVELOPER_TOKEN') || detail?.includes('UNIMPLEMENTED')
    console.error('[tool:get_google_ads_performance]', detail)
    return {
      summary: isDevToken
        ? 'Google Ads requires Standard Access approval for the developer token — contact Google Ads API support.'
        : `Google Ads fetch failed: ${String(detail).slice(0, 120)}`,
      content: JSON.stringify({ error: detail, connected: true, isDevTokenIssue: isDevToken }),
    }
  }
}

interface Ga4MetricValue { value: string }
interface Ga4DimensionValue { value: string }
interface Ga4Row {
  dimensionValues?: Ga4DimensionValue[]
  metricValues?: Ga4MetricValue[]
}
function toNumber(value?: string) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

async function get_ga4_analytics(
  args: { days?: number },
  context: AgentContext
): Promise<ToolResult> {
  const ga4 = context.connections.ga4
  if (!ga4?.accessToken) {
    return {
      summary: 'GA4 not connected.',
      content: JSON.stringify({ connected: false, message: 'Connect GA4 in Settings > Connections to see conversion and session data.' }),
    }
  }
  if (!ga4.propertyId) {
    return {
      summary: 'GA4 connected but no property selected.',
      content: JSON.stringify({ connected: true, configured: false, message: 'Select a GA4 property in Settings before running analytics.' }),
    }
  }

  const accessToken = await getValidGoogleToken(context.userId, 'ga4')
  if (!accessToken) {
    return {
      summary: 'GA4 token refresh failed.',
      content: JSON.stringify({ connected: true, configured: true, message: 'Reconnect GA4 in Settings to refresh access.' }),
    }
  }

  const days = args.days || 30
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${ga4.propertyId}:runReport`
  const headers = { Authorization: `Bearer ${accessToken}` }
  const range = [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }]

  try {
    const [overviewRes, channelRes, landingPageRes] = await Promise.all([
      axios.post(endpoint, {
        dateRanges: range,
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'engagedSessions' },
          { name: 'conversions' },
          { name: 'bounceRate' },
        ],
      }, { headers }),
      axios.post(endpoint, {
        dateRanges: range,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'conversions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }, { headers }),
      axios.post(endpoint, {
        dateRanges: range,
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [{ name: 'sessions' }, { name: 'conversions' }, { name: 'engagementRate' }, { name: 'bounceRate' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }, { headers }),
    ])

    const ov = overviewRes.data.totals?.[0]?.metricValues || []
    const bounceRate = Math.round(toNumber(ov[4]?.value) * 10000) / 100

    const byChannel = ((channelRes.data.rows || []) as Ga4Row[]).map(row => ({
      channel: row.dimensionValues?.[0]?.value || 'Unknown',
      sessions: toNumber(row.metricValues?.[0]?.value),
      conversions: toNumber(row.metricValues?.[1]?.value),
    }))

    const topLandingPages = ((landingPageRes.data.rows || []) as Ga4Row[]).map(row => ({
      path: row.dimensionValues?.[0]?.value || '/',
      sessions: toNumber(row.metricValues?.[0]?.value),
      conversions: toNumber(row.metricValues?.[1]?.value),
      engagementRate: Math.round(toNumber(row.metricValues?.[2]?.value) * 10000) / 100,
      bounceRate: Math.round(toNumber(row.metricValues?.[3]?.value) * 10000) / 100,
    }))

    const overview = {
      sessions: toNumber(ov[0]?.value),
      users: toNumber(ov[1]?.value),
      engagedSessions: toNumber(ov[2]?.value),
      conversions: toNumber(ov[3]?.value),
      bounceRate,
    }

    return {
      summary: `GA4 (${days}d): ${overview.sessions} sessions | ${overview.conversions} conversions | bounce ${overview.bounceRate}% | ${byChannel.length} channels`,
      content: JSON.stringify({
        connected: true,
        configured: true,
        propertyId: ga4.propertyId,
        propertyName: ga4.propertyName || '',
        dateRangeDays: days,
        overview,
        byChannel,
        topLandingPages,
      }),
    }
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? JSON.stringify(err.response?.data || err.message)
      : String(err)
    return {
      summary: `GA4 fetch failed: ${detail.slice(0, 120)}`,
      content: JSON.stringify({ connected: true, configured: true, propertyId: ga4.propertyId, error: detail }),
    }
  }
}

async function get_linkedin_analytics(context: AgentContext): Promise<ToolResult> {
  await connectDB()
  const uid = new mongoose.Types.ObjectId(context.userId)

  const [published, pending, scheduled] = await Promise.all([
    SocialPost.find({ userId: uid, platform: 'linkedin', status: 'published' })
      .sort({ publishedAt: -1 }).limit(10).lean() as Promise<Array<{ content: string; publishedAt?: Date; hashtags?: string[] }>>,
    SocialPost.countDocuments({ userId: uid, platform: 'linkedin', status: 'pending_approval' }),
    SocialPost.countDocuments({ userId: uid, platform: 'linkedin', status: 'scheduled' }),
  ])

  const connected = !!context.connections.linkedin?.profileId

  const summary = `LinkedIn: ${published.length} published posts | ${pending} pending approval | ${scheduled} scheduled | Profile ${connected ? 'connected' : 'not connected'}`

  return {
    summary,
    content: JSON.stringify({
      connected,
      profileName: context.connections.linkedin?.profileName || null,
      pageName: context.connections.linkedin?.pageName || null,
      stats: {
        published: published.length,
        pending,
        scheduled,
      },
      recentPosts: published.slice(0, 5).map(p => ({
        preview: p.content.slice(0, 120) + (p.content.length > 120 ? '…' : ''),
        publishedAt: p.publishedAt,
        hashtags: p.hashtags?.slice(0, 5),
      })),
      note: 'Detailed engagement metrics (likes, comments, shares) require storing LinkedIn post URNs at publish time — not yet implemented.',
    }),
  }
}

async function get_clarity_insights(context: AgentContext): Promise<ToolResult> {
  const clarity = context.connections.clarity
  if (!clarity?.projectId) {
    return {
      summary: 'Microsoft Clarity not connected.',
      content: JSON.stringify({ connected: false, message: 'Connect Clarity in Settings > Connections to see UX insights.' }),
    }
  }

  if (!clarity.clarityCache?.data) {
    return {
      summary: 'Clarity connected but no data cached yet.',
      content: JSON.stringify({
        connected: true,
        projectId: clarity.projectId,
        message: 'Visit the Analytics workspace to load Clarity data for the first time.',
      }),
    }
  }

  const data = clarity.clarityCache.data
  const cachedAt = clarity.clarityCache.cachedAt
  const ageHours = cachedAt ? Math.floor((Date.now() - new Date(cachedAt).getTime()) / 3600000) : null

  const overview = data.overview as Record<string, unknown> | undefined
  const summary = overview
    ? `Clarity: ${overview.totalSessions} sessions | ${overview.avgScrollDepth}% scroll depth | ${overview.deadClickRate}% dead clicks | ${overview.rageClickRate}% rage clicks${ageHours ? ` (${ageHours}h ago)` : ''}`
    : `Clarity data cached${ageHours ? ` ${ageHours}h ago` : ''}`

  return {
    summary,
    content: JSON.stringify({
      connected: true,
      cachedAt,
      cacheAgeHours: ageHours,
      ...data,
    }),
  }
}

async function get_content_calendar(context: AgentContext): Promise<ToolResult> {
  await connectDB()
  const uid = new mongoose.Types.ObjectId(context.userId)

  const [scheduledSocial, pendingSocial, scheduledBlog, pendingBlog, recentPublished] = await Promise.all([
    SocialPost.find({ userId: uid, status: 'scheduled' }).sort({ scheduledAt: 1 }).limit(20).lean() as Promise<Array<{ platform: string; content: string; scheduledAt?: Date; hashtags?: string[] }>>,
    SocialPost.find({ userId: uid, status: 'pending_approval' }).sort({ createdAt: -1 }).limit(10).lean() as Promise<Array<{ platform: string; content: string; createdAt?: Date }>>,
    BlogPost.find({ userId: uid, status: 'scheduled' }).sort({ scheduledAt: 1 }).limit(10).lean() as Promise<Array<{ title: string; scheduledAt?: Date; targetKeyword?: string }>>,
    BlogPost.find({ userId: uid, status: 'pending_approval' }).sort({ createdAt: -1 }).limit(5).lean() as Promise<Array<{ _id: unknown; title: string; targetKeyword?: string }>>,
    SocialPost.find({ userId: uid, status: 'published' }).sort({ publishedAt: -1 }).limit(5).lean() as Promise<Array<{ platform: string; content: string; publishedAt?: Date }>>,
  ])

  const summary = `Calendar: ${scheduledSocial.length} social + ${scheduledBlog.length} blog scheduled | ${pendingSocial.length} social + ${pendingBlog.length} blog pending approval`

  return {
    summary,
    content: JSON.stringify({
      scheduled: {
        social: scheduledSocial.map(p => ({
          platform: p.platform,
          preview: p.content.slice(0, 100) + '…',
          scheduledAt: p.scheduledAt,
        })),
        blog: scheduledBlog.map(p => ({
          title: p.title,
          scheduledAt: p.scheduledAt,
          targetKeyword: p.targetKeyword,
        })),
      },
      pendingApproval: {
        social: pendingSocial.map(p => ({
          platform: p.platform,
          preview: p.content.slice(0, 100) + '…',
        })),
        blog: pendingBlog.map(p => ({
          id: p._id,
          title: p.title,
          targetKeyword: p.targetKeyword,
        })),
      },
      recentPublished: recentPublished.map(p => ({
        platform: p.platform,
        preview: p.content.slice(0, 80) + '…',
        publishedAt: p.publishedAt,
      })),
    }),
  }
}

async function generate_blog_post(
  args: { topic: string; target_keyword?: string; tone?: string },
  context: AgentContext
): Promise<ToolResult> {
  const brand = context.brand || {}
  const keyword = args.target_keyword || args.topic
  const tone = args.tone || (brand.tone as string) || 'professional'

  const prompt = `You are writing a blog post for ${brand.name || 'a brand'}.

Topic: "${args.topic}"
Target keyword: "${keyword}"
Tone: ${tone}
Brand context: ${brand.product ? `Product/Service: ${brand.product}` : ''} ${brand.audience ? `| Audience: ${brand.audience}` : ''} ${brand.usp ? `| USP: ${brand.usp}` : ''}
${brand.avoidWords ? `Avoid these words: ${brand.avoidWords}` : ''}

Write a complete, SEO-optimized blog post of 800-1200 words.

Return ONLY valid JSON (no markdown code blocks):
{
  "title": "SEO-optimized title including the keyword",
  "content": "Full blog post in markdown with headers, bullet points, and good structure",
  "excerpt": "2-3 sentence summary for previews",
  "metaDescription": "120-160 char meta description with keyword",
  "targetKeyword": "${keyword}",
  "tags": ["tag1", "tag2", "tag3"]
}`

  const raw = await llm(prompt, skills.contentStrategy, 'powerful')
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Blog generation returned no JSON')

  const post = JSON.parse(match[0])

  await connectDB()
  const brand_doc = await Brand.findOne({ userId: context.userId }).lean() as { _id: unknown } | null

  const saved = await BlogPost.create({
    userId: context.userId,
    brandId: brand_doc?._id,
    title: post.title,
    content: post.content,
    excerpt: post.excerpt,
    metaDescription: post.metaDescription,
    targetKeyword: post.targetKeyword,
    tags: post.tags || [],
    status: 'pending_approval',
    generatedAt: new Date(),
  })

  return {
    summary: `Created blog draft: "${post.title}" — saved for review`,
    content: JSON.stringify({
      id: saved._id,
      title: post.title,
      targetKeyword: post.targetKeyword,
      wordCount: post.content.split(/\s+/).length,
      status: 'pending_approval',
      note: 'Draft saved — review and publish from the Blog workspace',
    }),
  }
}

async function generate_social_post(
  args: { platform: string; topic: string; tone?: string },
  context: AgentContext
): Promise<ToolResult> {
  const brand = context.brand || {}
  const charLimits: Record<string, number> = { linkedin: 3000, facebook: 63206, instagram: 2200 }
  const limit = charLimits[args.platform] || 3000
  const tone = args.tone || (brand.tone as string) || 'professional'

  const prompt = `Write a ${args.platform} post for ${brand.name || 'a brand'} about: "${args.topic}"

Brand: ${brand.name} | Product: ${brand.product} | Audience: ${brand.audience}
Tone: ${tone}
Character limit: ${limit}
${brand.avoidWords ? `Avoid: ${brand.avoidWords}` : ''}

Platform-specific guidance:
${args.platform === 'linkedin' ? '- Professional, insight-driven, hook in first line, line breaks for readability' : ''}
${args.platform === 'instagram' ? '- Visual storytelling, emotional, strong CTA, 20-30 relevant hashtags' : ''}
${args.platform === 'facebook' ? '- Conversational, shareable, clear value proposition' : ''}

Return ONLY valid JSON:
{"content": "the post text", "hashtags": ["hashtag1", "hashtag2"]}`

  const raw = await llm(prompt, skills.socialContent, 'medium')
  const match = raw.match(/\{[\s\S]*\}/)
  const post = match ? JSON.parse(match[0]) : { content: raw.slice(0, limit), hashtags: [] }

  await connectDB()
  const brand_doc = await Brand.findOne({ userId: context.userId }).lean() as { _id: unknown } | null

  const saved = await SocialPost.create({
    userId: context.userId,
    brandId: brand_doc?._id,
    platform: args.platform,
    content: post.content,
    hashtags: post.hashtags || [],
    status: 'pending_approval',
    generatedAt: new Date(),
  })

  return {
    summary: `Created ${args.platform} post draft (${post.content.length} chars) — saved for review`,
    content: JSON.stringify({
      id: saved._id,
      platform: args.platform,
      preview: post.content.slice(0, 150) + (post.content.length > 150 ? '…' : ''),
      charCount: post.content.length,
      hashtags: post.hashtags,
      status: 'pending_approval',
      note: 'Use publish_post with this ID to publish immediately, or schedule_post to schedule it',
    }),
  }
}

async function publish_post(
  args: { post_id: string },
  context: AgentContext
): Promise<ToolResult> {
  await connectDB()

  const post = await SocialPost.findOne({
    _id: args.post_id,
    userId: context.userId,
  }).lean() as { _id: unknown; platform: string; content: string; hashtags?: string[]; mediaUrl?: string; mediaType?: string } | null

  if (!post) {
    return {
      summary: `Post not found: ${args.post_id}`,
      content: JSON.stringify({ error: 'Post not found or does not belong to this user', post_id: args.post_id }),
    }
  }

  const conn = context.connections

  try {
    let platformPostId = ''

    if (post.platform === 'linkedin') {
      const li = conn.linkedin
      if (!li?.accessToken || !li?.profileId) {
        return {
          summary: 'LinkedIn not connected — go to Settings > Connections to connect.',
          content: JSON.stringify({ error: 'LINKEDIN_NOT_CONNECTED', platform: 'linkedin' }),
        }
      }
      const result = await publishToLinkedIn(
        { content: post.content, hashtags: post.hashtags },
        li.accessToken,
        li.profileId,
        li.pageId || undefined
      )
      platformPostId = result.id
    } else if (post.platform === 'facebook') {
      const fb = conn.facebook
      if (!fb?.pageAccessToken || !fb?.pageId) {
        return {
          summary: 'Facebook Page not connected — go to Settings > Connections to connect.',
          content: JSON.stringify({ error: 'FACEBOOK_NOT_CONNECTED', platform: 'facebook' }),
        }
      }
      const result = await publishToFacebook(
        { content: post.content, hashtags: post.hashtags },
        fb.pageAccessToken,
        fb.pageId
      )
      platformPostId = result.id
    } else if (post.platform === 'instagram') {
      const fb = conn.facebook
      const ig = conn.instagram
      if (!fb?.pageAccessToken || !ig?.accountId) {
        return {
          summary: 'Instagram not connected — go to Settings > Connections to connect.',
          content: JSON.stringify({ error: 'INSTAGRAM_NOT_CONNECTED', platform: 'instagram' }),
        }
      }
      if (!post.mediaUrl) {
        return {
          summary: 'Instagram posts require an image or video — this post has no media attached.',
          content: JSON.stringify({ error: 'INSTAGRAM_REQUIRES_MEDIA', platform: 'instagram', post_id: args.post_id }),
        }
      }
      const result = await publishToInstagram(
        { content: post.content, hashtags: post.hashtags, mediaUrl: post.mediaUrl, mediaType: post.mediaType },
        fb.pageAccessToken,
        ig.accountId
      )
      platformPostId = result.id
    } else {
      return {
        summary: `Platform "${post.platform}" not supported for publishing.`,
        content: JSON.stringify({ error: 'UNSUPPORTED_PLATFORM', platform: post.platform }),
      }
    }

    await SocialPost.findByIdAndUpdate(args.post_id, {
      status: 'published',
      publishedAt: new Date(),
      ...(platformPostId ? { platformPostId } : {}),
    })

    return {
      summary: `Published ${post.platform} post successfully${platformPostId ? ` (ID: ${platformPostId})` : ''}`,
      content: JSON.stringify({
        success: true,
        platform: post.platform,
        post_id: args.post_id,
        platformPostId,
        publishedAt: new Date().toISOString(),
      }),
    }
  } catch (err) {
    const msg = axios.isAxiosError(err)
      ? JSON.stringify(err.response?.data || err.message)
      : String(err)
    console.error('[tool:publish_post]', msg)

    await SocialPost.findByIdAndUpdate(args.post_id, { status: 'failed' })

    return {
      summary: `Failed to publish ${post.platform} post: ${msg.slice(0, 150)}`,
      content: JSON.stringify({ error: msg, platform: post.platform, post_id: args.post_id }),
    }
  }
}

async function schedule_post(
  args: { post_id: string; scheduled_for: string },
  context: AgentContext
): Promise<ToolResult> {
  await connectDB()

  const scheduledAt = new Date(args.scheduled_for)
  if (isNaN(scheduledAt.getTime())) {
    return {
      summary: `Invalid date format: "${args.scheduled_for}". Use ISO 8601 format, e.g. "2026-04-01T09:00:00Z"`,
      content: JSON.stringify({ error: 'INVALID_DATE', scheduled_for: args.scheduled_for }),
    }
  }

  if (scheduledAt <= new Date()) {
    return {
      summary: `Scheduled time is in the past. Provide a future datetime.`,
      content: JSON.stringify({ error: 'DATE_IN_PAST', scheduled_for: args.scheduled_for }),
    }
  }

  const post = await SocialPost.findOneAndUpdate(
    { _id: args.post_id, userId: context.userId },
    { status: 'scheduled', scheduledAt },
    { new: true }
  ).lean() as { platform: string } | null

  if (!post) {
    return {
      summary: `Post not found: ${args.post_id}`,
      content: JSON.stringify({ error: 'Post not found', post_id: args.post_id }),
    }
  }

  return {
    summary: `Scheduled ${post.platform} post for ${scheduledAt.toUTCString()}`,
    content: JSON.stringify({
      success: true,
      platform: post.platform,
      post_id: args.post_id,
      scheduledAt: scheduledAt.toISOString(),
    }),
  }
}

async function update_brand_info(
  args: { field: string; value: string },
  context: AgentContext
): Promise<ToolResult> {
  const allowedFields = ['name', 'product', 'audience', 'tone', 'usp', 'websiteUrl', 'avoidWords', 'currency']
  if (!allowedFields.includes(args.field)) {
    return {
      summary: `Invalid field "${args.field}". Allowed: ${allowedFields.join(', ')}`,
      content: JSON.stringify({ error: 'INVALID_FIELD', field: args.field }),
    }
  }

  await connectDB()
  await Brand.findOneAndUpdate(
    { userId: context.userId },
    { $set: { [args.field]: args.value } },
    { upsert: true }
  )

  return {
    summary: `Updated brand ${args.field} to "${args.value.slice(0, 60)}${args.value.length > 60 ? '…' : ''}"`,
    content: JSON.stringify({ success: true, field: args.field, value: args.value }),
  }
}

async function get_alerts(context: AgentContext): Promise<ToolResult> {
  await connectDB()

  const Alert = (await import('@/models/Alert')).default
  const userId = new mongoose.Types.ObjectId(context.userId)

  const alerts = await Alert.find(
    { userId, dismissed: false },
    { type: 1, severity: 1, title: 1, message: 1, data: 1, read: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(10)
    .lean() as Array<{
      _id: mongoose.Types.ObjectId
      type: string
      severity: string
      title: string
      message: string
      data?: Record<string, unknown>
      read: boolean
      createdAt: Date
    }>

  if (alerts.length === 0) {
    return {
      summary: 'No active alerts — everything looks good.',
      content: JSON.stringify({ count: 0, alerts: [] }),
    }
  }

  const unread = alerts.filter(a => !a.read)
  const summary = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''} (${unread.length} unread): ${alerts.slice(0, 3).map(a => a.title).join(' | ')}`

  return {
    summary,
    content: JSON.stringify({
      count: alerts.length,
      unreadCount: unread.length,
      alerts: alerts.map(a => ({
        id: a._id.toString(),
        type: a.type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        data: a.data,
        read: a.read,
        createdAt: a.createdAt,
      })),
    }),
  }
}

async function dismiss_alert(
  args: { alert_id: string },
  context: AgentContext
): Promise<ToolResult> {
  if (!mongoose.isValidObjectId(args.alert_id)) {
    return {
      summary: `Invalid alert ID: ${args.alert_id}`,
      content: JSON.stringify({ error: 'INVALID_ID', alert_id: args.alert_id }),
    }
  }

  await connectDB()

  const Alert = (await import('@/models/Alert')).default
  const userId = new mongoose.Types.ObjectId(context.userId)

  const alert = await Alert.findOneAndUpdate(
    { _id: args.alert_id, userId },
    { $set: { read: true, dismissed: true } },
    { new: true }
  ).lean() as { type: string; title: string } | null

  if (!alert) {
    return {
      summary: `Alert not found: ${args.alert_id}`,
      content: JSON.stringify({ error: 'NOT_FOUND', alert_id: args.alert_id }),
    }
  }

  return {
    summary: `Dismissed "${alert.title}"`,
    content: JSON.stringify({ success: true, alert_id: args.alert_id, type: alert.type }),
  }
}

// ── Nango Integration Tools ───────────────────────────────────────────────────

async function get_shopify_orders(
  args: { days?: number; limit?: number; status?: string },
  context: AgentContext,
): Promise<ToolResult> {
  const conn = context.integrations.find(i => i.integration === 'shopify')
  if (!conn) return { summary: 'Shopify not connected', content: 'Shopify integration is not connected. Ask the user to connect it from the Integrations page.' }

  const days   = Math.min(args.days ?? 30, 90)
  const limit  = Math.min(args.limit ?? 50, 250)
  const status = args.status ?? 'any'

  const cacheKey = buildCacheKey(context.userId, 'shopify', 'orders', { days, limit, status })
  const cached   = await getCachedIntegrationResult(cacheKey)
  if (cached) return cached as ToolResult

  const createdAtMin = new Date(Date.now() - days * 86400000).toISOString()
  const data = await nangoGet(conn.connectionId, 'shopify', '/admin/api/2024-01/orders.json', {
    status,
    limit:          String(limit),
    created_at_min: createdAtMin,
  }) as { orders?: Array<Record<string, unknown>> }

  const orders  = data.orders ?? []
  const summary = `Fetched ${orders.length} Shopify orders (last ${days} days)`
  const content = JSON.stringify({ orderCount: orders.length, orders: orders.slice(0, 20) })

  const result: ToolResult = { summary, content }
  await setCachedIntegrationResult(cacheKey, result)
  return result
}

async function get_shopify_revenue(
  args: { days?: number },
  context: AgentContext,
): Promise<ToolResult> {
  const conn = context.integrations.find(i => i.integration === 'shopify')
  if (!conn) return { summary: 'Shopify not connected', content: 'Shopify integration is not connected.' }

  const days     = Math.min(args.days ?? 30, 90)
  const cacheKey = buildCacheKey(context.userId, 'shopify', 'revenue', { days })
  const cached   = await getCachedIntegrationResult(cacheKey)
  if (cached) return cached as ToolResult

  const createdAtMin = new Date(Date.now() - days * 86400000).toISOString()
  const data = await nangoGet(conn.connectionId, 'shopify', '/admin/api/2024-01/orders.json', {
    status:           'any',
    limit:            '250',
    created_at_min:   createdAtMin,
    financial_status: 'paid',
  }) as { orders?: Array<{ total_price?: string }> }

  const orders       = data.orders ?? []
  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_price ?? '0'), 0)
  const aov          = orders.length > 0 ? totalRevenue / orders.length : 0

  const summary = `Shopify revenue last ${days}d: $${totalRevenue.toFixed(2)} across ${orders.length} paid orders (AOV $${aov.toFixed(2)})`
  const content = JSON.stringify({ days, orderCount: orders.length, totalRevenue: totalRevenue.toFixed(2), aov: aov.toFixed(2) })

  const result: ToolResult = { summary, content }
  await setCachedIntegrationResult(cacheKey, result)
  return result
}

async function get_hubspot_deals(
  args: { limit?: number; stage?: string },
  context: AgentContext,
): Promise<ToolResult> {
  const conn = context.integrations.find(i => i.integration === 'hubspot')
  if (!conn) return { summary: 'HubSpot not connected', content: 'HubSpot integration is not connected.' }

  const limit    = Math.min(args.limit ?? 50, 100)
  const cacheKey = buildCacheKey(context.userId, 'hubspot', 'deals', { limit, stage: args.stage })
  const cached   = await getCachedIntegrationResult(cacheKey)
  if (cached) return cached as ToolResult

  const params: Record<string, string> = {
    limit:      String(limit),
    properties: 'dealname,amount,dealstage,closedate,hubspot_owner_id',
    archived:   'false',
  }
  if (args.stage) params.dealstage = args.stage

  const data = await nangoGet(conn.connectionId, 'hubspot', '/crm/v3/objects/deals', params) as {
    results?: Array<{ id: string; properties: Record<string, string> }>
  }

  const deals      = data.results ?? []
  const totalValue = deals.reduce((sum, d) => sum + parseFloat(d.properties.amount ?? '0'), 0)
  const summary    = `Fetched ${deals.length} HubSpot deals, total pipeline value: $${totalValue.toFixed(2)}`
  const content    = JSON.stringify({ dealCount: deals.length, totalPipelineValue: totalValue.toFixed(2), deals: deals.slice(0, 20) })

  const result: ToolResult = { summary, content }
  await setCachedIntegrationResult(cacheKey, result)
  return result
}

async function get_stripe_revenue(
  args: { days?: number },
  context: AgentContext,
): Promise<ToolResult> {
  const conn = context.integrations.find(i => i.integration === 'stripe')
  if (!conn) return { summary: 'Stripe not connected', content: 'Stripe integration is not connected.' }

  const days         = Math.min(args.days ?? 30, 90)
  const cacheKey     = buildCacheKey(context.userId, 'stripe', 'revenue', { days })
  const cached       = await getCachedIntegrationResult(cacheKey)
  if (cached) return cached as ToolResult

  const createdAfter = Math.floor((Date.now() - days * 86400000) / 1000)

  const chargesData = await nangoGet(conn.connectionId, 'stripe', '/v1/charges', {
    limit:   '100',
    created: String(createdAfter),
  }) as { data?: Array<{ amount: number; status: string }> }

  const subsData = await nangoGet(conn.connectionId, 'stripe', '/v1/subscriptions', {
    limit:  '100',
    status: 'active',
  }) as { data?: Array<{ plan?: { amount?: number; interval?: string } }> }

  const charges          = chargesData.data ?? []
  const subs             = subsData.data ?? []
  const successfulCharges = charges.filter(c => c.status === 'succeeded')
  const totalRevenue     = successfulCharges.reduce((sum, c) => sum + c.amount, 0) / 100
  const mrrCents         = subs.reduce((sum, s) => {
    const amount   = s.plan?.amount ?? 0
    const interval = s.plan?.interval ?? 'month'
    return sum + (interval === 'year' ? Math.round(amount / 12) : amount)
  }, 0)
  const mrr = mrrCents / 100

  const summary = `Stripe last ${days}d: $${totalRevenue.toFixed(2)} revenue, ${subs.length} active subscriptions, MRR ~$${mrr.toFixed(2)}`
  const content = JSON.stringify({ days, totalRevenue: totalRevenue.toFixed(2), chargeCount: successfulCharges.length, activeSubscriptions: subs.length, estimatedMrr: mrr.toFixed(2) })

  const result: ToolResult = { summary, content }
  await setCachedIntegrationResult(cacheKey, result)
  return result
}

// ── Dispatcher ─────────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  switch (name) {
    case 'get_brand_context':
      return get_brand_context(context)
    case 'get_seo_report':
      return get_seo_report(context)
    case 'run_seo_audit':
      return run_seo_audit(args as { url?: string }, context)
    case 'get_keyword_rankings':
      return get_keyword_rankings(args as { limit?: number; sort_by?: string }, context)
    case 'get_analytics_summary':
      return get_analytics_summary(context)
    case 'get_competitor_insights':
      return get_competitor_insights(context)
    case 'run_competitor_analysis':
      return run_competitor_analysis(context)
    case 'get_meta_ads_performance':
      return get_meta_ads_performance(args as { days?: number }, context)
    case 'get_google_ads_performance':
      return get_google_ads_performance(args as { days?: number }, context)
    case 'get_ga4_analytics':
      return get_ga4_analytics(args as { days?: number }, context)
    case 'get_linkedin_analytics':
      return get_linkedin_analytics(context)
    case 'get_clarity_insights':
      return get_clarity_insights(context)
    case 'get_content_calendar':
      return get_content_calendar(context)
    case 'generate_blog_post':
      return generate_blog_post(args as { topic: string; target_keyword?: string; tone?: string }, context)
    case 'generate_social_post':
      return generate_social_post(args as { platform: string; topic: string; tone?: string }, context)
    case 'publish_post':
      return publish_post(args as { post_id: string }, context)
    case 'schedule_post':
      return schedule_post(args as { post_id: string; scheduled_for: string }, context)
    case 'update_brand_info':
      return update_brand_info(args as { field: string; value: string }, context)
    case 'get_alerts':
      return get_alerts(context)
    case 'dismiss_alert':
      return dismiss_alert(args as { alert_id: string }, context)
    case 'get_shopify_orders':
      return get_shopify_orders(args as { days?: number; limit?: number; status?: string }, context)
    case 'get_shopify_revenue':
      return get_shopify_revenue(args as { days?: number }, context)
    case 'get_hubspot_deals':
      return get_hubspot_deals(args as { limit?: number; stage?: string }, context)
    case 'get_stripe_revenue':
      return get_stripe_revenue(args as { days?: number }, context)
    default:
      return { summary: `Unknown tool: ${name}`, content: `Tool "${name}" not found.` }
  }
}

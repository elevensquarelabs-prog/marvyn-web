import { connectDB } from '@/lib/mongodb'
import { executeTool, type AgentContext } from './tools'
import { loadHistories } from './memory'
import { deriveFetchDomain } from './routing'
import type { ContextBoard, AgentName } from './board'

/**
 * Analyst runs first — no LLM call.
 * Infers fetch domain from goal, fetches only relevant data,
 * loads candidate agent histories from MongoDB.
 * Writes contextBundle + agentHistories to board.
 */
export async function runAnalyst(
  board: ContextBoard,
  context: AgentContext,
  inferredDomains: string[]
): Promise<void> {
  await connectDB()

  const fetchDomain = deriveFetchDomain(inferredDomains, board.goal.userRequest)

  // Determine which agent histories to pre-load as candidates
  const candidateAgents = getCandidateAgents(inferredDomains)

  // Load histories in parallel with data fetch
  const [bundle, histories] = await Promise.all([
    fetchBundle(fetchDomain, context),
    loadHistories(context.userId, candidateAgents),
  ])

  board.contextBundle = bundle
  board.agentHistories = histories
}

function getCandidateAgents(inferredDomains: string[]): AgentName[] {
  const agents: AgentName[] = []
  if (inferredDomains.includes('ads')) agents.push('ads')
  if (inferredDomains.includes('seo')) agents.push('seo')
  if (inferredDomains.includes('content')) agents.push('content')
  if (inferredDomains.includes('ecommerce')) agents.push('ads', 'content', 'strategist')
  if (inferredDomains.includes('strategy')) {
    // For strategy, load all agent histories as Strategist needs them
    return ['ads', 'seo', 'content', 'strategist']
  }
  if (agents.length === 0) return [] // general/fallback — CMO handles directly
  return agents
}

async function fetchBundle(
  domain: string,
  context: AgentContext
): Promise<Record<string, unknown>> {
  const bundle: Record<string, unknown> = {}

  try {
    switch (domain) {
      case 'seo': {
        const [seoReport, keywords, brand] = await Promise.allSettled([
          executeTool('get_seo_report', {}, context),
          executeTool('get_keyword_rankings', { limit: 25 }, context),
          executeTool('get_brand_context', {}, context),
        ])
        if (seoReport.status === 'fulfilled') bundle.seoAudit = seoReport.value
        if (keywords.status === 'fulfilled') bundle.gsc = keywords.value
        if (brand.status === 'fulfilled') bundle.brand = brand.value
        break
      }

      case 'ads': {
        // Only fetch connected platforms — skip GA4 from initial load to reduce
        // prompt cost. The CMO can assign a GA4 task if conversion diagnosis is needed.
        const fetches: Promise<Awaited<ReturnType<typeof executeTool>>>[] = [
          executeTool('get_brand_context', {}, context),
        ]
        const keys: string[] = ['brand']
        if (context.connections.meta?.accountId) {
          fetches.push(executeTool('get_meta_ads_performance', {}, context))
          keys.push('metaAds')
        }
        if (context.connections.google?.customerId) {
          fetches.push(executeTool('get_google_ads_performance', {}, context))
          keys.push('googleAds')
        }
        const results = await Promise.allSettled(fetches)
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') bundle[keys[i]] = r.value
        })
        break
      }

      case 'content_site': {
        const [analytics, calendar, brand, competitors] = await Promise.allSettled([
          executeTool('get_analytics_summary', {}, context),
          executeTool('get_content_calendar', {}, context),
          executeTool('get_brand_context', {}, context),
          executeTool('get_competitor_insights', {}, context),
        ])
        if (analytics.status === 'fulfilled') bundle.ga4Organic = analytics.value
        if (calendar.status === 'fulfilled') bundle.calendar = calendar.value
        if (brand.status === 'fulfilled') bundle.brand = brand.value
        if (competitors.status === 'fulfilled') bundle.competitors = competitors.value
        break
      }

      case 'content_social': {
        const [calendar, brand, meta, analytics] = await Promise.allSettled([
          executeTool('get_content_calendar', {}, context),
          executeTool('get_brand_context', {}, context),
          executeTool('get_meta_ads_performance', {}, context),
          executeTool('get_analytics_summary', {}, context),
        ])
        if (calendar.status === 'fulfilled') bundle.calendar = calendar.value
        if (brand.status === 'fulfilled') bundle.brand = brand.value
        if (meta.status === 'fulfilled') bundle.socialPerformance = meta.value
        if (analytics.status === 'fulfilled') bundle.ga4Organic = analytics.value
        break
      }

      case 'ecommerce': {
        const fetches = [
          executeTool('get_brand_context', {}, context),
          executeTool('get_shopify_data', {}, context),
        ]
        const keys = ['brand', 'ecommerce']
        if (context.connections.meta?.accountId) {
          fetches.push(executeTool('get_meta_ads_performance', {}, context))
          keys.push('metaAds')
        }
        if (context.connections.google?.customerId) {
          fetches.push(executeTool('get_google_ads_performance', {}, context))
          keys.push('googleAds')
        }
        const results = await Promise.allSettled(fetches)
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') bundle[keys[i]] = r.value
        })
        break
      }

      case 'strategy': {
        // Cross-channel summary — fetch broad but not raw everything
        const [brand, analytics, seo, calendar] = await Promise.allSettled([
          executeTool('get_brand_context', {}, context),
          executeTool('get_analytics_summary', {}, context),
          executeTool('get_seo_report', {}, context),
          executeTool('get_content_calendar', {}, context),
        ])
        if (brand.status === 'fulfilled') bundle.brand = brand.value
        if (analytics.status === 'fulfilled') bundle.ga4Organic = analytics.value
        if (seo.status === 'fulfilled') bundle.seoAudit = seo.value
        if (calendar.status === 'fulfilled') bundle.calendar = calendar.value
        break
      }

      default: {
        // general — brand context only
        const brand = await executeTool('get_brand_context', {}, context).catch(() => null)
        if (brand) bundle.brand = brand
        break
      }
    }
  } catch (err) {
    console.error('[Analyst] fetch error:', err)
    // Return partial bundle — CMO will surface missing data warning
  }

  return bundle
}

import type { AgentName } from './board'
import type { RawConnections } from './tools'

const VALID_MENTIONS: AgentName[] = ['ads', 'seo', 'content', 'strategist']

/** Extract @mention from message. Returns AgentName or null. */
export function parseAtMention(message: string): AgentName | null {
  const match = message.match(/@(\w+)/i)
  if (!match) return null
  const candidate = match[1].toLowerCase() as AgentName
  return VALID_MENTIONS.includes(candidate) ? candidate : null
}

const DOMAIN_SIGNALS: Record<string, string[]> = {
  ads: [
    'roas', 'campaign', 'ad spend', 'cpa', 'cpm', 'ctr', 'paid', 'meta ads',
    'google ads', 'linkedin ads', 'budget', 'impressions', 'creative', 'ad performance',
    'conversion rate', 'cost per',
  ],
  seo: [
    'ranking', 'rankings', 'seo', 'organic', 'search console', 'keyword', 'crawl',
    'audit', 'backlink', 'sitemap', 'meta description', 'title tag', 'index', 'serp',
    'search traffic',
  ],
  content: [
    'blog', 'post', 'social', 'instagram', 'linkedin post', 'facebook', 'content',
    'calendar', 'write', 'caption', 'tweet', 'article', 'copy', 'email', 'newsletter',
    'content plan', 'content strategy', 'engagement',
  ],
  strategy: [
    'plan', 'strategy', 'roadmap', 'quarter', '30 day', '7 day', 'priorities',
    'goal', 'focus', 'next steps', 'what should i', 'where should i', 'recommend',
  ],
  ecommerce: [
    'shopify', 'store', 'orders', 'revenue', 'sales', 'products', 'product', 'aov',
    'average order', 'cart', 'checkout', 'abandonment', 'abandoned cart', 'ltv',
    'customer lifetime', 'repeat customer', 'returning customer', 'ecommerce', 'e-commerce',
    'refund', 'bestseller', 'inventory', 'conversion rate',
  ],
}

/**
 * Infer candidate domains from the user message.
 * Uses userRequest keywords + selectedAgent hint + connected integrations.
 * NOTE: domainTags do NOT exist yet at this point — CMO creates them later.
 */
export function inferDomains(
  userRequest: string,
  selectedAgent: AgentName | null | undefined,
  connections: RawConnections
): string[] {
  const lower = userRequest.toLowerCase()
  const found = new Set<string>()

  // selectedAgent is the strongest signal
  if (selectedAgent) found.add(selectedAgent)

  // Keyword matching
  for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
    if (signals.some((s) => lower.includes(s))) {
      found.add(domain)
    }
  }

  // Warn-level: if ads inferred but no ad platform connected, CMO will handle
  // (we still include ads so CMO can surface the missing integration message)

  // Default to general CMO handling if nothing matched
  if (found.size === 0) found.add('general')

  return Array.from(found)
}

/** Derive the fetch domain key for the Analyst from inferred domains. */
export function deriveFetchDomain(
  inferredDomains: string[],
  userRequest: string
): string {
  if (inferredDomains.includes('strategy')) return 'strategy'
  if (inferredDomains.includes('ecommerce')) return 'ecommerce'
  if (inferredDomains.includes('ads')) return 'ads'
  if (inferredDomains.includes('seo')) return 'seo'

  if (inferredDomains.includes('content')) {
    const lower = userRequest.toLowerCase()
    const isSocial = ['social', 'instagram', 'facebook', 'linkedin post', 'caption', 'tweet'].some(
      (s) => lower.includes(s)
    )
    return isSocial ? 'content_social' : 'content_site'
  }

  return 'general'
}

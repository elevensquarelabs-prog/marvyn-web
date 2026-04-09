/**
 * marketing-context.ts
 *
 * The canonical contract between Brand data and every AI specialist.
 * All routes/agents must use buildMarketingContext() instead of building
 * ad-hoc brand strings. This ensures every specialist reasons over the
 * same structured world-view.
 */

import type { IBrand } from '@/models/Brand'

export interface MarketingContextBlock {
  /** Compact string injected at the top of every specialist system prompt */
  promptBlock: string
  /** Structured fields for agents that need to reason over them programmatically */
  structured: {
    brandName: string
    product: string
    audience: string
    icp: string
    businessModel: string
    primaryGoal: string
    primaryConversion: string
    averageOrderValue: string
    currency: string
    primaryChannels: string[]
    tone: string
    usp: string
    differentiation: string
    corePains: string[]
    desiredOutcomes: string[]
    alternatives: string[]
    objections: string[]
    proofPoints: string[]
    customerLanguage: string[]
    funnelPriority: string
    strategicConstraints: string[]
    websiteUrl: string
    avoidWords: string
    topCompetitors: string[]
  }
}

/**
 * Builds the canonical marketing context block from a Brand document.
 * Pass the full brand object — this function handles missing fields gracefully.
 */
export function buildMarketingContext(brand: Partial<IBrand> | null | undefined): MarketingContextBlock {
  const b = brand ?? {}
  const mc = (b as IBrand).marketingContext ?? {}

  const brandName = String(b.name || 'this brand')
  const product = String(b.product || '')
  const audience = String(b.audience || '')
  const icp = String(mc.icp || audience)
  const businessModel = String(b.businessModel || 'saas')
  const primaryGoal = String(b.primaryGoal || '')
  const primaryConversion = String(b.primaryConversion || '')
  const aov = b.averageOrderValue ? String(b.averageOrderValue) : ''
  const currency = String(b.currency || 'USD')
  const primaryChannels = Array.isArray(b.primaryChannels) ? b.primaryChannels.filter(Boolean) : []
  const tone = String(b.tone || 'professional')
  const usp = String(b.usp || '')
  const differentiation = String(mc.differentiation || usp)
  const corePains = Array.isArray(mc.corePains) ? mc.corePains.filter(Boolean) : []
  const desiredOutcomes = Array.isArray(mc.desiredOutcomes) ? mc.desiredOutcomes.filter(Boolean) : []
  const alternatives = Array.isArray(mc.alternatives) ? mc.alternatives.filter(Boolean) : []
  const objections = Array.isArray(mc.objections) ? mc.objections.filter(Boolean) : []
  const proofPoints = Array.isArray(mc.proofPoints) ? mc.proofPoints.filter(Boolean) : []
  const customerLanguage = Array.isArray(mc.customerLanguage) ? mc.customerLanguage.filter(Boolean) : []
  const funnelPriority = String(mc.funnelPriority || 'conversion')
  const strategicConstraints = Array.isArray(mc.strategicConstraints) ? mc.strategicConstraints.filter(Boolean) : []
  const websiteUrl = String(b.websiteUrl || '')
  const avoidWords = String(b.avoidWords || '')

  const competitors = (b as IBrand).competitors ?? []
  const topCompetitors = competitors
    .filter(c => c.name || c.url)
    .slice(0, 5)
    .map(c => c.name || c.url)

  // Also pull domains from competitorAnalysis if richer
  const analysisCompetitors = (b as IBrand).competitorAnalysis?.competitors ?? []
  const analysisDomains = analysisCompetitors.slice(0, 5).map(c => c.domain || c.title).filter(Boolean)
  const allCompetitors = [...new Set([...topCompetitors, ...analysisDomains])].slice(0, 6)

  const lines: string[] = [
    `## Business Context`,
    `Brand: ${brandName}`,
    `Product: ${product}`,
    `Business model: ${businessModel}`,
    websiteUrl ? `Website: ${websiteUrl}` : '',
    ``,
    `## Customer`,
    `ICP: ${icp}`,
    corePains.length ? `Core pains:\n${corePains.map(p => `- ${p}`).join('\n')}` : '',
    desiredOutcomes.length ? `Desired outcomes:\n${desiredOutcomes.map(o => `- ${o}`).join('\n')}` : '',
    customerLanguage.length ? `How they describe the problem: "${customerLanguage.join('" / "')}"` : '',
    ``,
    `## Positioning`,
    `USP / differentiation: ${differentiation}`,
    alternatives.length ? `Alternatives they consider: ${alternatives.join(', ')}` : '',
    allCompetitors.length ? `Known competitors: ${allCompetitors.join(', ')}` : '',
    objections.length ? `Common objections:\n${objections.map(o => `- ${o}`).join('\n')}` : '',
    proofPoints.length ? `Proof points:\n${proofPoints.map(p => `- ${p}`).join('\n')}` : '',
    ``,
    `## Goals & Execution`,
    `Primary goal: ${primaryGoal}`,
    `Primary conversion event: ${primaryConversion}`,
    aov ? `Average order / deal value: ${aov} ${currency}` : '',
    primaryChannels.length ? `Active channels: ${primaryChannels.join(', ')}` : '',
    `Funnel priority this cycle: ${funnelPriority}`,
    strategicConstraints.length ? `Constraints:\n${strategicConstraints.map(c => `- ${c}`).join('\n')}` : '',
    ``,
    `## Brand Voice`,
    `Tone: ${tone}`,
    avoidWords ? `Never use: ${avoidWords}` : '',
  ]

  const promptBlock = lines.filter(l => l !== '').join('\n').trim()

  return {
    promptBlock,
    structured: {
      brandName,
      product,
      audience,
      icp,
      businessModel,
      primaryGoal,
      primaryConversion,
      averageOrderValue: aov,
      currency,
      primaryChannels,
      tone,
      usp,
      differentiation,
      corePains,
      desiredOutcomes,
      alternatives,
      objections,
      proofPoints,
      customerLanguage,
      funnelPriority,
      strategicConstraints,
      websiteUrl,
      avoidWords,
      topCompetitors: allCompetitors,
    },
  }
}

/**
 * Injects the marketing context block into a skill system prompt.
 * Usage: buildSystemPrompt(skills.copywriting, brand)
 */
export function buildSystemPrompt(skill: string, brand: Partial<IBrand> | null | undefined): string {
  const ctx = buildMarketingContext(brand)
  return `${skill}\n\n---\n\n# Active Business Context\nUse the following context as ground truth. Do not ask for information already provided here.\n\n${ctx.promptBlock}`
}

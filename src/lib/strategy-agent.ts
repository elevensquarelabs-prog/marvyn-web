import axios from 'axios'
import Brand from '@/models/Brand'
import BlogPost from '@/models/BlogPost'
import Keyword from '@/models/Keyword'
import SEOAudit from '@/models/SEOAudit'
import SocialPost from '@/models/SocialPost'
import StrategyPlanModel, {
  type IStrategyDiagnosis,
  type IStrategyPerformanceSnapshot,
  type IStrategyQuestionAnswer,
  type IStrategyReview,
} from '@/models/StrategyPlan'
import User from '@/models/User'
import { llm } from '@/lib/llm'
import { skills } from '@/lib/skills'
import { buildMarketingContext } from '@/lib/marketing-context'
import { estimateCostInr, getModelNameFromComplexity } from '@/lib/ai-usage'
import { getValidGoogleToken } from '@/lib/google-auth'
import { getAdsInsightsForUser } from '@/lib/ads-performance'

type StrategyPriority = {
  title: string
  reason: string
  actions: string[]
}

type StrategyChannel = {
  channel: string
  platformRole?: string
  focus: string
  kpi: string
  cadence?: string
  outputTarget?: string
  effort?: 'low' | 'medium' | 'high'
  executionNote?: string
}

export type GeneratedStrategyPlan = {
  summary: string
  northStarMetric: string
  successMetric?: {
    label: string
    target: string
  }
  priorities: StrategyPriority[]
  channelPlan: StrategyChannel[]
  contentIdeas: string[]
  risks: string[]
}

export type StrategyQuestion = {
  key: string
  question: string
  placeholder?: string
}

type StrategyContext = {
  brand: {
    name: string
    product?: string
    audience?: string
    tone?: string
    usp?: string
    websiteUrl?: string
    businessModel: string
    primaryGoal: string
    primaryConversion: string
    averageOrderValue?: string
    primaryChannels: string[]
  }
  additionalAnswers: Record<string, string>
  content: {
    blogCount: number
    socialCount: number
  }
  seo: {
    score?: number | null
    totalKeywordClicks: number
    topKeywords: Array<{ keyword: string; clicks: number; impressions: number; position?: number }>
    keywordOpportunities: Array<{ keyword: string; searchVolume?: number; difficulty?: number }>
    issues: string[]
    competitors: string[]
  }
  analytics: {
    ga4?: {
      sessions: number
      users: number
      conversions: number
      bounceRate: number
      topChannels: Array<{ label: string; sessions: number; conversions: number }>
    } | null
    clarity?: {
      totalSessions?: number
      avgScrollDepth?: number
      deadClickRate?: number
      rageClickRate?: number
      topInsight?: string
    } | null
    paid?: {
      spend: number
      clicks: number
      conversions: number
      roas: number | null
      ctr: number
      cpa: number | null
      topCampaigns: Array<{ name: string; platform: 'meta' | 'google' | 'linkedin'; spend: number; conversions: number; roas: number | null }>
      errors: string[]
    } | null
    connected: string[]
  }
  previousCycle?: {
    summary: string
    northStarMetric: string
    successMetric?: { label?: string; target?: string }
    completionRate: number
    review?: IStrategyReview
  } | null
}

export type StrategyAgentSuccess = {
  kind: 'success'
  questionAnswers: IStrategyQuestionAnswer[]
  diagnosis: IStrategyDiagnosis
  plan: GeneratedStrategyPlan
  usage: {
    inputTokens: number
    outputTokens: number
    estimatedCostInr: number
    model: string
  }[]
}

export type StrategyAgentNeedsInput = {
  kind: 'needs_input'
  questions: StrategyQuestion[]
  questionAnswers: IStrategyQuestionAnswer[]
}

export type StrategyAgentResult = StrategyAgentSuccess | StrategyAgentNeedsInput

function metricDelta(current?: number | null, baseline?: number | null) {
  if (current == null || baseline == null) return null
  return current - baseline
}

function formatSignedNumber(value: number, suffix = '') {
  if (value === 0) return `0${suffix}`
  return `${value > 0 ? '+' : ''}${Number(value.toFixed(1))}${suffix}`
}

function buildSignalChanges(baseline?: IStrategyPerformanceSnapshot, current?: IStrategyPerformanceSnapshot) {
  if (!baseline || !current) return [] as string[]
  const changes: string[] = []

  const conversionDelta = metricDelta(current.ga4Conversions, baseline.ga4Conversions)
  if (conversionDelta !== null) {
    changes.push(`GA4 conversions changed by ${formatSignedNumber(conversionDelta)} (${baseline.ga4Conversions || 0} → ${current.ga4Conversions || 0}).`)
  }

  const sessionDelta = metricDelta(current.ga4Sessions, baseline.ga4Sessions)
  if (sessionDelta !== null) {
    changes.push(`GA4 sessions changed by ${formatSignedNumber(sessionDelta)} (${baseline.ga4Sessions || 0} → ${current.ga4Sessions || 0}).`)
  }

  const organicDelta = metricDelta(current.organicClicks, baseline.organicClicks)
  if (organicDelta !== null) {
    changes.push(`Organic clicks changed by ${formatSignedNumber(organicDelta)} (${baseline.organicClicks || 0} → ${current.organicClicks || 0}).`)
  }

  const paidConversionDelta = metricDelta(current.paidConversions, baseline.paidConversions)
  if (paidConversionDelta !== null) {
    changes.push(`Paid conversions changed by ${formatSignedNumber(paidConversionDelta)} (${baseline.paidConversions || 0} → ${current.paidConversions || 0}).`)
  }

  const assetDelta = metricDelta(
    (current.blogCount || 0) + (current.socialCount || 0),
    (baseline.blogCount || 0) + (baseline.socialCount || 0)
  )
  if (assetDelta !== null) {
    changes.push(`Published assets changed by ${formatSignedNumber(assetDelta)} (${(baseline.blogCount || 0) + (baseline.socialCount || 0)} → ${(current.blogCount || 0) + (current.socialCount || 0)}).`)
  }

  const completionRate = current.totalTasks
    ? Math.round(((current.completedTasks || 0) / current.totalTasks) * 100)
    : 0
  changes.push(`Execution completion reached ${completionRate}% (${current.completedTasks || 0}/${current.totalTasks || 0} tasks done).`)

  return changes
}

function normalizeBusinessModel(value?: string) {
  const raw = (value || '').toLowerCase().trim()
  if (raw.includes('d2c') || raw.includes('ecommerce') || raw.includes('e-commerce')) return 'd2c_ecommerce'
  if (raw.includes('service')) return 'services_lead_gen'
  if (raw.includes('lead gen')) return 'services_lead_gen'
  if (raw.includes('saas')) return 'saas'
  return undefined
}

export function normalizeQuestionAnswers(input: unknown): IStrategyQuestionAnswer[] {
  if (!Array.isArray(input)) return []
  return input
    .map(item => ({
      key: typeof item?.key === 'string' ? item.key.trim() : '',
      question: typeof item?.question === 'string' ? item.question.trim() : '',
      answer: typeof item?.answer === 'string' ? item.answer.trim() : '',
    }))
    .filter(item => item.key && item.answer)
}

function answerMap(answers: IStrategyQuestionAnswer[]) {
  return Object.fromEntries(answers.map(item => [item.key, item.answer]))
}

function normalizeChannelList(value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

export function getStrategyQuestions(brandLike: Partial<StrategyContext['brand']>, answers: IStrategyQuestionAnswer[] = []): StrategyQuestion[] {
  const provided = answerMap(answers)
  const questions: StrategyQuestion[] = []

  if (!brandLike.businessModel && !provided.businessModel) {
    questions.push({
      key: 'businessModel',
      question: 'Which business model best describes you this cycle: SaaS, D2C / Ecommerce, or Services / Lead Gen?',
      placeholder: 'e.g. SaaS',
    })
  }
  if (!brandLike.primaryGoal && !provided.primaryGoal) {
    questions.push({
      key: 'primaryGoal',
      question: 'What is the one business outcome that matters most in the next 30 days?',
      placeholder: 'e.g. Increase trial signups, close more demos, drive revenue',
    })
  }
  if (!brandLike.primaryConversion && !provided.primaryConversion) {
    questions.push({
      key: 'primaryConversion',
      question: 'What exact event should count as success this cycle?',
      placeholder: 'e.g. Paid purchase, booked demo, trial signup, qualified lead',
    })
  }
  if ((!brandLike.primaryChannels || brandLike.primaryChannels.length === 0) && !provided.primaryChannels) {
    questions.push({
      key: 'primaryChannels',
      question: 'Which 2-4 channels can your team realistically execute this month?',
      placeholder: 'e.g. SEO, Instagram, Google Ads, Email',
    })
  }
  if (!brandLike.averageOrderValue && !provided.averageOrderValue) {
    questions.push({
      key: 'averageOrderValue',
      question: 'What is your average order value, contract value, or first-month revenue from a new customer?',
      placeholder: 'e.g. ₹4,999 annual plan or ₹15,000 per closed lead',
    })
  }
  if (!provided.teamCapacity) {
    questions.push({
      key: 'teamCapacity',
      question: 'What can your team actually ship in 30 days without breaking?',
      placeholder: 'e.g. 4 blogs, 12 Instagram posts, 1 landing page, 1 paid test',
    })
  }

  return questions.slice(0, 6)
}

async function fetchGa4Snapshot(userId: string, userDoc: { connections?: { ga4?: { propertyId?: string } } }) {
  const propertyId = userDoc.connections?.ga4?.propertyId
  if (!propertyId) return null

  const accessToken = await getValidGoogleToken(userId, 'ga4')
  if (!accessToken) return null

  try {
    const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`
    const headers = { Authorization: `Bearer ${accessToken}` }
    const range = [{ startDate: '30daysAgo', endDate: 'yesterday' }]
    const [overviewRes, channelRes] = await Promise.all([
      axios.post(endpoint, {
        dateRanges: range,
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'conversions' },
          { name: 'bounceRate' },
        ],
      }, { headers }),
      axios.post(endpoint, {
        dateRanges: range,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'conversions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 5,
      }, { headers }),
    ])

    const totals = overviewRes.data.totals?.[0]?.metricValues || []
    return {
      sessions: Number(totals[0]?.value || 0),
      users: Number(totals[1]?.value || 0),
      conversions: Number(totals[2]?.value || 0),
      bounceRate: Number(totals[3]?.value || 0) * 100,
      topChannels: ((channelRes.data.rows || []) as Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }>).map(row => ({
        label: row.dimensionValues?.[0]?.value || 'Unknown',
        sessions: Number(row.metricValues?.[0]?.value || 0),
        conversions: Number(row.metricValues?.[1]?.value || 0),
      })),
    }
  } catch {
    return null
  }
}

export async function collectStrategyContext(userId: string, answers: IStrategyQuestionAnswer[]): Promise<StrategyContext> {
  const [brandDoc, topKeywords, latestAudit, blogCount, socialCount, previousCycle, userDoc] = await Promise.all([
    Brand.findOne({ userId }).lean() as Promise<Record<string, unknown> | null>,
    Keyword.find({ userId }).sort({ clicks: -1, impressions: -1, createdAt: -1 }).limit(10).lean() as Promise<Array<{ keyword?: string; clicks?: number; impressions?: number; currentPosition?: number }>>,
    SEOAudit.findOne({ userId, status: 'complete' }).sort({ createdAt: -1 }).lean() as Promise<{
      score?: number | null
      issues?: Array<{ title?: string }>
      keywordOpportunities?: Array<{ keyword?: string; searchVolume?: number; difficulty?: number }>
      competitors?: Array<{ domain?: string }>
    } | null>,
    BlogPost.countDocuments({ userId }),
    SocialPost.countDocuments({ userId }),
    StrategyPlanModel.findOne({ userId, status: 'completed' }).sort({ completedAt: -1, updatedAt: -1 }).lean() as Promise<{
      summary: string
      northStarMetric: string
      successMetric?: { label?: string; target?: string }
      tasks?: Array<{ done?: boolean }>
      review?: IStrategyReview
    } | null>,
    User.findById(userId).select('connections').lean() as Promise<{ connections?: { ga4?: { propertyId?: string }; clarity?: { clarityCache?: { data?: Record<string, unknown> } }; google?: { customerId?: string }; meta?: { accountId?: string } } } | null>,
  ])

  if (!brandDoc?.name) {
    throw new Error('Set up your brand profile first.')
  }

  const provided = answerMap(answers)
  const primaryChannels = Array.isArray(brandDoc.primaryChannels)
    ? brandDoc.primaryChannels.map(String).filter(Boolean)
    : []

  const clarityCache = userDoc?.connections?.clarity?.clarityCache?.data as {
    overview?: { totalSessions?: number; avgScrollDepth?: number; deadClickRate?: number; rageClickRate?: number }
    aiInsights?: Array<{ headline?: string }>
  } | undefined

  const [ga4, paid] = await Promise.all([
    fetchGa4Snapshot(userId, userDoc || {}),
    getAdsInsightsForUser({ userId, days: 30 }).catch(() => null),
  ])

  return {
    brand: {
      name: String(brandDoc.name),
      product: String(brandDoc.product || ''),
      audience: String(brandDoc.audience || ''),
      tone: String(brandDoc.tone || ''),
      usp: String(brandDoc.usp || ''),
      websiteUrl: String(brandDoc.websiteUrl || ''),
      businessModel: normalizeBusinessModel(provided.businessModel) || String(brandDoc.businessModel || 'saas'),
      primaryGoal: String(provided.primaryGoal || brandDoc.primaryGoal || ''),
      primaryConversion: String(provided.primaryConversion || brandDoc.primaryConversion || ''),
      averageOrderValue: String(provided.averageOrderValue || brandDoc.averageOrderValue || ''),
      primaryChannels: provided.primaryChannels ? normalizeChannelList(provided.primaryChannels) : primaryChannels,
    },
    additionalAnswers: Object.fromEntries(
      answers
        .filter(item => !['businessModel', 'primaryGoal', 'primaryConversion', 'averageOrderValue', 'primaryChannels'].includes(item.key))
        .map(item => [item.key, item.answer])
    ),
    content: {
      blogCount,
      socialCount,
    },
    seo: {
      score: latestAudit?.score,
      totalKeywordClicks: topKeywords.reduce((sum, item) => sum + (item.clicks || 0), 0),
      topKeywords: topKeywords.map(item => ({
        keyword: String(item.keyword || ''),
        clicks: Number(item.clicks || 0),
        impressions: Number(item.impressions || 0),
        position: item.currentPosition,
      })),
      keywordOpportunities: (latestAudit?.keywordOpportunities || []).slice(0, 5).map(item => ({
        keyword: String(item.keyword || ''),
        searchVolume: item.searchVolume,
        difficulty: item.difficulty,
      })),
      issues: (latestAudit?.issues || []).map(item => String(item.title || '')).filter(Boolean).slice(0, 5),
      competitors: (latestAudit?.competitors || []).map(item => String(item.domain || '')).filter(Boolean).slice(0, 5),
    },
    analytics: {
      ga4,
      clarity: clarityCache ? {
        totalSessions: clarityCache.overview?.totalSessions,
        avgScrollDepth: clarityCache.overview?.avgScrollDepth,
        deadClickRate: clarityCache.overview?.deadClickRate,
        rageClickRate: clarityCache.overview?.rageClickRate,
        topInsight: clarityCache.aiInsights?.[0]?.headline,
      } : null,
      paid: paid ? {
        spend: paid.spend,
        clicks: paid.clicks,
        conversions: paid.conversions,
        roas: paid.roas,
        ctr: paid.ctr,
        cpa: paid.cpa,
        topCampaigns: paid.campaigns.slice(0, 5).map(item => ({
          name: item.name,
          platform: item.platform,
          spend: item.spend,
          conversions: item.conversions,
          roas: item.roas,
        })),
        errors: paid.errors,
      } : null,
      connected: [
        userDoc?.connections?.ga4?.propertyId ? 'GA4' : '',
        paid?.connected.google ? 'Google Ads' : '',
        paid?.connected.meta ? 'Meta Ads' : '',
        clarityCache ? 'Clarity' : '',
      ].filter(Boolean),
    },
    previousCycle: previousCycle ? {
      summary: previousCycle.summary,
      northStarMetric: previousCycle.northStarMetric,
      successMetric: previousCycle.successMetric,
      completionRate: previousCycle.tasks?.length
        ? Math.round((previousCycle.tasks.filter(task => task.done).length / previousCycle.tasks.length) * 100)
        : 0,
      review: previousCycle.review,
    } : null,
  }
}

export async function collectCycleSnapshot(userId: string, taskStats?: { completedTasks?: number; totalTasks?: number }): Promise<IStrategyPerformanceSnapshot> {
  const [topKeywords, blogCount, socialCount, userDoc] = await Promise.all([
    Keyword.find({ userId }).sort({ clicks: -1, impressions: -1, createdAt: -1 }).limit(50).lean() as Promise<Array<{ clicks?: number }>>,
    BlogPost.countDocuments({ userId, status: 'published' }).catch(() => BlogPost.countDocuments({ userId })),
    SocialPost.countDocuments({ userId, status: 'published' }).catch(() => SocialPost.countDocuments({ userId })),
    User.findById(userId).select('connections').lean() as Promise<{ connections?: { ga4?: { propertyId?: string } } } | null>,
  ])

  const [ga4, paid] = await Promise.all([
    fetchGa4Snapshot(userId, userDoc || {}),
    getAdsInsightsForUser({ userId, days: 30 }).catch(() => null),
  ])

  return {
    capturedAt: new Date(),
    ga4Sessions: ga4?.sessions,
    ga4Users: ga4?.users,
    ga4Conversions: ga4?.conversions,
    ga4BounceRate: ga4?.bounceRate,
    organicClicks: topKeywords.reduce((sum, item) => sum + (item.clicks || 0), 0),
    paidSpend: paid?.spend,
    paidClicks: paid?.clicks,
    paidConversions: paid?.conversions,
    paidRoas: paid?.roas ?? null,
    paidCtr: paid?.ctr,
    blogCount,
    socialCount,
    completedTasks: taskStats?.completedTasks,
    totalTasks: taskStats?.totalTasks,
  }
}

function buildUsage(system: string, prompt: string, output: string, complexity: 'fast' | 'medium' | 'powerful') {
  const model = getModelNameFromComplexity(complexity)
  const usage = estimateCostInr({
    model,
    inputText: `${system}\n${prompt}`,
    outputText: output,
  })
  return { ...usage, model }
}

function parseJson<T>(raw: string): T | null {
  try {
    const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const match = clean.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : clean) as T
  } catch {
    return null
  }
}

function extractLeadingNumber(text?: string) {
  const match = (text || '').match(/(\d+)/)
  return match ? Number(match[1]) : null
}

function isWeakSocialCadence(channel: StrategyChannel) {
  const key = (channel.channel || '').toLowerCase()
  const isSocial = ['instagram', 'twitter', 'x', 'linkedin', 'reddit', 'meta', 'facebook', 'youtube'].some(label => key.includes(label))
  if (!isSocial) return false
  const cadence = (channel.cadence || '').toLowerCase()
  const outputTarget = (channel.outputTarget || '').toLowerCase()
  const outputCount = extractLeadingNumber(outputTarget)
  if (cadence.includes('one ') || cadence.includes('1 ') || cadence.includes('single')) return true
  if (outputCount !== null && outputCount <= 2) return true
  return false
}

function sanitizeText(value?: string) {
  return (value || '')
    .replace(/\b(Brevo|Mailchimp|CapCut|Canva|HubSpot|Figma|Zapier|Notion)\b/gi, 'your existing workflow')
    .replace(/₹\s?\d[\d,]*(?:-\d[\d,]*)?/g, 'a controlled test budget')
    .replace(/\b(Ubersuggest|AnswerThePublic|Google Search Console|Google Analytics 4)\b/gi, 'your connected analytics stack')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeChannels(plan: GeneratedStrategyPlan, preferredChannels: string[]) {
  const normalized = plan.channelPlan.map(channel => {
    const next = {
      ...channel,
      platformRole: sanitizeText(channel.platformRole),
      focus: sanitizeText(channel.focus),
      kpi: sanitizeText(channel.kpi),
      cadence: sanitizeText(channel.cadence),
      outputTarget: sanitizeText(channel.outputTarget),
      executionNote: sanitizeText(channel.executionNote),
      effort: channel.effort || 'medium',
    }
    if (!next.platformRole) next.platformRole = 'Execution lane'
    if (!next.cadence) next.cadence = next.effort === 'high' ? '2-3 pushes per week' : '1-2 pushes per week'
    if (!next.outputTarget) next.outputTarget = next.effort === 'high' ? '8-12 outputs in 30 days' : '4-6 outputs in 30 days'
    if (isWeakSocialCadence(next)) {
      next.cadence = '3-4 posts per week'
      next.outputTarget = '10-16 outputs in 30 days'
      next.effort = next.effort === 'low' ? 'medium' : next.effort
    }
    return next
  })

  const keys = new Set(normalized.map(item => item.channel.toLowerCase()))
  for (const preferred of preferredChannels) {
    const key = preferred.toLowerCase()
    if (normalized.length >= 6 || keys.has(key)) continue
    if (key.includes('instagram')) {
      normalized.push({
        channel: 'Instagram',
        platformRole: 'Awareness and proof',
        focus: 'Build trust with short-form product proof.',
        kpi: 'Profile visits and signups',
        cadence: '3-4 reels per week',
        outputTarget: '12-16 reels in 30 days',
        effort: 'high',
        executionNote: 'Show product proof, not generic motivation.',
      })
      continue
    }
    normalized.push({
      channel: preferred,
      platformRole: 'Support lane',
      focus: 'Support the main conversion path this cycle.',
      kpi: 'Channel contribution',
      cadence: '1-2 pushes per week',
      outputTarget: '4-6 outputs in 30 days',
      effort: 'medium',
      executionNote: 'Keep this channel narrow and measurable.',
    })
  }

  return normalized.slice(0, 6)
}

function buildTasks(plan: GeneratedStrategyPlan) {
  return plan.priorities.flatMap(priority =>
    priority.actions.map(action => ({
      title: sanitizeText(action),
      done: false,
      sourcePriority: sanitizeText(priority.title),
    }))
  )
}

function alignPlan(plan: GeneratedStrategyPlan, context: StrategyContext) {
  const repaired = {
    ...plan,
    summary: sanitizeText(plan.summary),
    northStarMetric: sanitizeText(plan.northStarMetric),
    successMetric: plan.successMetric ? {
      label: sanitizeText(plan.successMetric.label),
      target: sanitizeText(plan.successMetric.target),
    } : undefined,
    priorities: plan.priorities.slice(0, 3).map(priority => ({
      title: sanitizeText(priority.title),
      reason: sanitizeText(priority.reason),
      actions: priority.actions.slice(0, 4).map(action => sanitizeText(action)),
    })),
    channelPlan: normalizeChannels(plan, context.brand.primaryChannels),
    contentIdeas: plan.contentIdeas.slice(0, 5).map(item => sanitizeText(item)),
    risks: plan.risks.slice(0, 5).map(item => sanitizeText(item)),
  }

  const goal = `${context.brand.primaryGoal} ${context.brand.primaryConversion}`.toLowerCase()
  if (goal.includes('sale') || goal.includes('revenue') || goal.includes('purchase')) {
    const label = repaired.successMetric?.label?.toLowerCase() || ''
    if (label.match(/lead|trial|signup|sign-up/) && !context.brand.primaryConversion.toLowerCase().match(/lead|trial|signup|sign-up/)) {
      repaired.successMetric = {
        label: context.brand.primaryConversion || 'Sales conversions',
        target: repaired.successMetric?.target || 'Close more sales in 30 days',
      }
    }
  }

  return repaired
}

function fallbackDiagnosis(context: StrategyContext): IStrategyDiagnosis {
  return {
    bottleneck: `${context.brand.name} lacks one clear conversion path tied to ${context.brand.primaryConversion || 'its main business outcome'}.`,
    positioningRisk: `${context.brand.name} risks sounding credible but generic if it talks about research quality without a sharp customer outcome.`,
    channelThesis: context.brand.primaryChannels.slice(0, 4).map(channel => `${channel}: one clear job only this cycle.`),
    executionConstraints: [
      `${context.content.blogCount} blogs and ${context.content.socialCount} social posts mean the team must keep scope tight.`,
      'Paid traffic should stay narrow until the landing page and conversion path are measurable.',
    ],
  }
}

function fallbackPlan(context: StrategyContext): GeneratedStrategyPlan {
  const mainChannel = context.brand.primaryChannels[0] || 'SEO'
  return {
    summary: `${context.brand.name} needs a sharper conversion path before scaling more channels. The next 30 days should ship a clear offer, measurable acquisition, and one supporting content engine.`,
    northStarMetric: context.brand.primaryConversion || 'Qualified conversions',
    successMetric: {
      label: context.brand.primaryConversion || 'Qualified conversions',
      target: '20-40 meaningful conversions in 30 days',
    },
    priorities: [
      {
        title: 'Clarify the conversion path',
        reason: 'Current messaging and CTA path are still too broad.',
        actions: [
          'Rewrite the core value proposition around one customer outcome.',
          'Put one primary CTA above the fold on every key page.',
          'Track the main conversion event end to end.',
        ],
      },
      {
        title: `Make ${mainChannel} earn its role`,
        reason: `The plan needs one accountable acquisition lane, not channel sprawl.`,
        actions: [
          `Define one KPI for ${mainChannel} this cycle.`,
          `Ship weekly outputs for ${mainChannel} without adding side projects.`,
          'Review results weekly and cut non-performing activity.',
        ],
      },
      {
        title: 'Create proof before scaling spend',
        reason: 'The team needs stronger proof and intent capture before aggressive growth.',
        actions: [
          'Publish bottom-funnel proof content tied to the core customer problem.',
          'Use content and landing pages to capture demand before scaling budgets.',
          'Collect wins and objections to feed the next cycle.',
        ],
      },
    ],
    channelPlan: context.brand.primaryChannels.slice(0, 4).map(channel => ({
      channel,
      platformRole: 'Execution lane',
      focus: 'Support the main growth bottleneck this cycle.',
      kpi: context.brand.primaryConversion || 'Qualified conversions',
      cadence: '2 pushes per week',
      outputTarget: '8 outputs in 30 days',
      effort: 'medium',
      executionNote: 'Keep execution narrow and measurable.',
    })),
    contentIdeas: [
      'One buyer-objection page',
      'One proof-driven founder post',
      'One conversion-focused landing page',
    ],
    risks: [
      'Too many channels without enough shipping capacity.',
      'Traffic growth before conversion clarity wastes effort.',
      'Content that educates but does not convert.',
    ],
  }
}

async function runPass<T>(params: { prompt: string; system: string; complexity: 'medium' | 'powerful'; fallback: T }) {
  try {
    const raw = await llm(params.prompt, params.system, params.complexity)
    const usage = buildUsage(params.system, params.prompt, raw, params.complexity)
    const parsed = parseJson<T>(raw)
    return { parsed: parsed || params.fallback, usage }
  } catch {
    return { parsed: params.fallback, usage: { inputTokens: 0, outputTokens: 0, estimatedCostInr: 0, model: getModelNameFromComplexity(params.complexity) } }
  }
}

export async function runStrategyAgent(userId: string, answers: IStrategyQuestionAnswer[]): Promise<StrategyAgentResult> {
  const context = await collectStrategyContext(userId, answers)
  const questions = getStrategyQuestions(context.brand, answers)
  if (questions.length > 0) {
    return {
      kind: 'needs_input',
      questions,
      questionAnswers: answers,
    }
  }

  const brandDoc = await Brand.findOne({ userId }).lean()
  const marketingCtx = buildMarketingContext(brandDoc as Parameters<typeof buildMarketingContext>[0])

  const contextBlob = JSON.stringify({
    brand: context.brand,
    marketingContext: marketingCtx.structured,
    extraContext: context.additionalAnswers,
    content: context.content,
    seo: context.seo,
    analytics: context.analytics,
    previousCycle: context.previousCycle,
  }, null, 2)

  const diagnosisFallback = fallbackDiagnosis(context)
  const diagnosisSystem = `${skills.marketingOpsPlan}

You are the Strategy Diagnosis Agent.
- Decide the single primary bottleneck before recommending anything.
- If a channel should be paused this cycle, say so.
- Use the exact brand name and actual numbers from the context.
- Return valid JSON only.`

  const diagnosisPrompt = `Analyze this business and diagnose the next 30-day marketing bottleneck.

Context:
${contextBlob}

Return JSON:
{
  "bottleneck": "one specific bottleneck",
  "positioningRisk": "one specific positioning risk",
  "channelThesis": ["Channel: its single job this cycle", "Channel: skip this cycle because ..."],
  "executionConstraints": ["specific capacity constraint", "specific dependency"]
}`

  const diagnosisPass = await runPass<IStrategyDiagnosis>({
    prompt: diagnosisPrompt,
    system: diagnosisSystem,
    complexity: 'medium',
    fallback: diagnosisFallback,
  })

  const planFallback = fallbackPlan(context)
  const planningSystem = `${skills.marketingOpsPlan}

You are the Strategy Planning Agent.
- Build one 30-day operating plan from the diagnosis and context.
- Do not recommend channels that the diagnosis deprioritized.
- Every priority must directly solve the bottleneck.
- Each channel lane needs role, cadence, output target, effort, KPI, and execution note.
- Return valid JSON only.`

  const planningPrompt = `Build the 30-day strategy draft for ${context.brand.name}.

Context:
${contextBlob}

Diagnosis:
${JSON.stringify(diagnosisPass.parsed, null, 2)}

Rules:
- Max 3 priorities
- 3-6 channel lanes
- Keep outputs realistic for current content volume
- The north star and success metric must align to the primary goal and conversion event

Return JSON:
{
  "summary": "string",
  "northStarMetric": "string",
  "successMetric": { "label": "string", "target": "string" },
  "priorities": [{ "title": "string", "reason": "string", "actions": ["string"] }],
  "channelPlan": [{ "channel": "string", "platformRole": "string", "focus": "string", "kpi": "string", "cadence": "string", "outputTarget": "string", "effort": "low | medium | high", "executionNote": "string" }],
  "contentIdeas": ["string"],
  "risks": ["string"]
}`

  const planningPass = await runPass<GeneratedStrategyPlan>({
    prompt: planningPrompt,
    system: planningSystem,
    complexity: 'powerful',
    fallback: planFallback,
  })

  const criticSystem = `${skills.marketingOpsPlan}

You are the Strategy Critic Agent.
- Fix contradictions, weak cadence, vanity KPIs, and channel overload.
- Reject plans where the KPI does not match the actual stated goal or conversion event.
- Reject plans that ask a low-volume team to execute unrealistic content output.
- Return the corrected final JSON plan only.`

  const criticPrompt = `Critique and repair this strategy before it is shown to the user.

Context:
${contextBlob}

Diagnosis:
${JSON.stringify(diagnosisPass.parsed, null, 2)}

Draft plan:
${JSON.stringify(planningPass.parsed, null, 2)}

Repair requirements:
- If the plan says sales/revenue but the KPI is leads/signups without justification, fix it.
- If social cadence is too weak, increase it to a realistic minimum.
- If the plan includes generic filler, replace it with brand-specific language.
- If the previous cycle failed on the same issue, force a different priority order.
- Keep output in the same JSON shape as the draft plan.`

  const criticPass = await runPass<GeneratedStrategyPlan>({
    prompt: criticPrompt,
    system: criticSystem,
    complexity: 'powerful',
    fallback: planningPass.parsed,
  })

  return {
    kind: 'success',
    questionAnswers: answers,
    diagnosis: diagnosisPass.parsed,
    plan: alignPlan(criticPass.parsed, context),
    usage: [diagnosisPass.usage, planningPass.usage, criticPass.usage],
  }
}

export function buildDraftPayload(params: {
  userId: string
  context: StrategyContext
  questionAnswers: IStrategyQuestionAnswer[]
  diagnosis: IStrategyDiagnosis
  plan: GeneratedStrategyPlan
  customAdjustments?: string
}) {
  const alignedPlan = alignPlan(params.plan, params.context)
  return {
    userId: params.userId,
    businessModel: params.context.brand.businessModel,
    primaryGoal: params.context.brand.primaryGoal,
    primaryConversion: params.context.brand.primaryConversion,
    primaryChannels: params.context.brand.primaryChannels,
    questionAnswers: params.questionAnswers,
    diagnosis: params.diagnosis,
    summary: alignedPlan.summary,
    northStarMetric: alignedPlan.northStarMetric,
    successMetric: alignedPlan.successMetric,
    priorities: alignedPlan.priorities,
    channelPlan: alignedPlan.channelPlan,
    contentIdeas: alignedPlan.contentIdeas,
    risks: alignedPlan.risks,
    tasks: buildTasks(alignedPlan),
    customAdjustments: params.customAdjustments || '',
    manualNotes: '',
    manualWins: '',
    review: undefined,
    generationState: 'idle' as const,
    generationError: '',
    status: 'draft' as const,
    startDate: undefined,
    endDate: undefined,
    committedAt: undefined,
    completedAt: undefined,
  }
}

export async function synthesizeCycleReview(params: {
  plan: {
    summary: string
    northStarMetric: string
    successMetric?: { label?: string; target?: string }
    priorities?: Array<{ title?: string }>
    tasks?: Array<{ title?: string; done?: boolean }>
    manualWins?: string
    manualNotes?: string
    customAdjustments?: string
  }
  actualSignal: string
  baselineSnapshot?: IStrategyPerformanceSnapshot
  actualSnapshot?: IStrategyPerformanceSnapshot
}) {
  const signalChanges = buildSignalChanges(params.baselineSnapshot, params.actualSnapshot)
  const fallback: IStrategyReview = {
    actualSignal: params.actualSignal,
    summary: 'Cycle closed without a synthesized review.',
    executionSummary: signalChanges[signalChanges.length - 1] || 'Execution completion could not be summarized.',
    signalChanges,
    whatWorked: params.plan.manualWins ? [sanitizeText(params.plan.manualWins)] : [],
    whatFailed: params.plan.manualNotes ? [sanitizeText(params.plan.manualNotes)] : [],
    nextCycleFocus: ['Tighten the next cycle around the clearest measurable bottleneck.'],
  }

  const system = `${skills.marketingOpsPlan}

You are the Cycle Review Agent.
- Review what actually happened versus what the strategy expected.
- Output only actionable learnings for the next 30-day plan.
- Return valid JSON only.`

  const prompt = `Review this completed strategy cycle.

Plan summary: ${params.plan.summary}
North star: ${params.plan.northStarMetric}
Success metric: ${params.plan.successMetric?.label || 'Not set'} / target ${params.plan.successMetric?.target || 'Not set'}
Actual signal: ${params.actualSignal}
Signal changes: ${signalChanges.join(' | ') || 'No baseline signal comparison available'}
Priorities: ${(params.plan.priorities || []).map(item => item.title).filter(Boolean).join(' | ')}
Tasks done: ${(params.plan.tasks || []).filter(item => item.done).length}/${params.plan.tasks?.length || 0}
Manual wins: ${params.plan.manualWins || 'none'}
Manual blockers: ${params.plan.manualNotes || 'none'}
Mid-cycle adjustments: ${params.plan.customAdjustments || 'none'}

Return JSON:
{
  "actualSignal": "string",
  "summary": "1-2 sentence review summary",
  "executionSummary": "1 sentence on what actually got executed",
  "signalChanges": ["string"],
  "whatWorked": ["string"],
  "whatFailed": ["string"],
  "nextCycleFocus": ["string"]
}`

  const pass = await runPass<IStrategyReview>({
    prompt,
    system,
    complexity: 'medium',
    fallback,
  })

  return { review: pass.parsed, usage: pass.usage }
}

import mongoose from 'mongoose'
import Keyword from '@/models/Keyword'
import AgentMemory from '@/models/AgentMemory'
import BusinessSnapshot from '@/models/BusinessSnapshot'
import { llm } from '@/lib/llm'
import { fetchShopifyBundle } from '@/lib/shopify'
import axios from 'axios'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeekMetrics {
  gsc: { clicks: number; impressions: number; avgPosition: number } | null
  metaAds: { spend: number; cpl: number; roas: number; ctr: number } | null
  shopify: { revenue: number; orderCount: number; aov: number; repeatRate: number; abandonmentRate: number; discountedOrderShare: number } | null
}

export interface MetricDelta {
  key: string
  label: string
  current: number
  previous: number
  changePct: number          // positive = up, negative = down
  direction: 'up' | 'down' | 'flat'
  isPositive: boolean        // whether "up" is good for this metric
}

export interface PatternFlag {
  key: string
  description: string
  weeksObserved: number
  direction: 'negative' | 'positive'
}

export interface OpenRecommendation {
  recommendation: string
  agent: string
  timestamp: string
  followUpAt?: string
}

export interface BriefData {
  brandName: string
  weekLabel: string
  deltas: MetricDelta[]
  patterns: PatternFlag[]
  openRecs: OpenRecommendation[]
  rawMetrics: { current: WeekMetrics; previous: WeekMetrics | null }
}

export interface GeneratedBrief {
  subject: string
  whatChanged: string[]         // bullet insights with point of view
  patterns: string[]            // 3-week pattern flags
  theOneThing: { action: string; reasoning: string; confidence: 'High' | 'Medium' | 'Low' }
  stillOpen: string[]           // unacted recs from memory
  fullSummary: string           // 2-3 sentence narrative for the alert
}

// ─── Data fetching ────────────────────────────────────────────────────────────

function daysAgo(n: number, from?: Date): Date {
  const d = from ? new Date(from) : new Date()
  d.setDate(d.getDate() - n)
  return d
}

function isoDate(d: Date) { return d.toISOString() }

async function fetchGscMetrics(userId: string, startDate: Date, endDate: Date): Promise<WeekMetrics['gsc']> {
  // Use stored Keyword model data — already synced from GSC
  const start = startDate
  const end = endDate
  const keywords = await Keyword.find(
    { userId, source: { $in: ['search_console', 'search_console_page'] } },
    { clicks: 1, impressions: 1, currentPosition: 1 }
  ).lean() as { clicks?: number; impressions?: number; currentPosition?: number }[]

  if (!keywords.length) return null

  const clicks = keywords.reduce((s, k) => s + (k.clicks ?? 0), 0)
  const impressions = keywords.reduce((s, k) => s + (k.impressions ?? 0), 0)
  const positions = keywords.filter(k => k.currentPosition).map(k => k.currentPosition!)
  const avgPosition = positions.length ? Math.round(positions.reduce((s, p) => s + p, 0) / positions.length * 10) / 10 : 0

  // Note: Keyword model is cumulative, not date-ranged.
  // For true week-over-week, snapshots are the mechanism. This is the current week's stored state.
  void start; void end  // future: filter by updatedAt when GSC sync stores per-date records
  return { clicks, impressions, avgPosition }
}

async function fetchMetaWeekMetrics(
  accessToken: string,
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<WeekMetrics['metaAds']> {
  try {
    const since = startDate.toISOString().slice(0, 10)
    const until = endDate.toISOString().slice(0, 10)
    const fields = 'spend,actions,action_values,impressions,clicks,cpc'
    const res = await axios.get(
      `https://graph.facebook.com/v19.0/act_${accountId}/insights`,
      {
        params: { access_token: accessToken, fields, time_range: JSON.stringify({ since, until }), level: 'account' },
        timeout: 10_000,
      }
    )
    const d = res.data?.data?.[0]
    if (!d) return null

    const spend = parseFloat(d.spend ?? '0')
    const actions = (d.actions ?? []) as { action_type: string; value: string }[]
    const purchases = actions.find(a => a.action_type === 'purchase')?.value
    const purchaseCount = purchases ? parseFloat(purchases) : 0
    const actionValues = (d.action_values ?? []) as { action_type: string; value: string }[]
    const purchaseValue = actionValues.find(a => a.action_type === 'purchase')?.value
    const revenue = purchaseValue ? parseFloat(purchaseValue) : 0

    return {
      spend: Math.round(spend),
      cpl: purchaseCount > 0 ? Math.round(spend / purchaseCount) : 0,
      roas: spend > 0 ? Math.round((revenue / spend) * 10) / 10 : 0,
      ctr: d.impressions > 0 ? Math.round((parseInt(d.clicks ?? '0') / parseInt(d.impressions)) * 10000) / 100 : 0,
    }
  } catch {
    return null
  }
}

async function fetchShopifyWeekMetrics(
  shop: string,
  accessToken: string,
  days: number
): Promise<WeekMetrics['shopify']> {
  try {
    const bundle = await fetchShopifyBundle({ shop, accessToken })
    const rev = bundle.revenue as Record<string, unknown> | null
    const abn = bundle.abandonment as Record<string, unknown> | null
    const dis = bundle.discounts as { summary?: Record<string, unknown> } | null
    if (!rev) return null
    return {
      revenue: (rev.last30Days as number) ?? 0,   // approximated to window
      orderCount: (rev.orderCount30d as number) ?? 0,
      aov: (rev.avgOrderValue as number) ?? 0,
      repeatRate: (rev.repeatRate as number) ?? 0,
      abandonmentRate: (abn?.abandonmentRate as number) ?? 0,
      discountedOrderShare: (dis?.summary?.discountedOrderShare as number) ?? 0,
    }
  } catch {
    return null
  }
  void days
}

// ─── Delta computation ────────────────────────────────────────────────────────

function pct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function dir(changePct: number): 'up' | 'down' | 'flat' {
  if (changePct > 3) return 'up'
  if (changePct < -3) return 'down'
  return 'flat'
}

export function computeDeltas(current: WeekMetrics, previous: WeekMetrics | null): MetricDelta[] {
  if (!previous) return []
  const deltas: MetricDelta[] = []

  // GSC
  if (current.gsc && previous.gsc) {
    const clicksChg = pct(current.gsc.clicks, previous.gsc.clicks)
    deltas.push({ key: 'gsc_clicks', label: 'Organic clicks', current: current.gsc.clicks, previous: previous.gsc.clicks, changePct: clicksChg, direction: dir(clicksChg), isPositive: true })
    const posChg = pct(current.gsc.avgPosition, previous.gsc.avgPosition)
    deltas.push({ key: 'gsc_position', label: 'Avg search position', current: current.gsc.avgPosition, previous: previous.gsc.avgPosition, changePct: posChg, direction: dir(posChg), isPositive: false }) // lower = better
  }

  // Meta Ads
  if (current.metaAds && previous.metaAds) {
    const cplChg = pct(current.metaAds.cpl, previous.metaAds.cpl)
    const roasChg = pct(current.metaAds.roas, previous.metaAds.roas)
    deltas.push({ key: 'meta_cpl', label: 'Meta CPL', current: current.metaAds.cpl, previous: previous.metaAds.cpl, changePct: cplChg, direction: dir(cplChg), isPositive: false })
    deltas.push({ key: 'meta_roas', label: 'Meta ROAS', current: current.metaAds.roas, previous: previous.metaAds.roas, changePct: roasChg, direction: dir(roasChg), isPositive: true })
  }

  // Shopify
  if (current.shopify && previous.shopify) {
    const revChg = pct(current.shopify.revenue, previous.shopify.revenue)
    const aovChg = pct(current.shopify.aov, previous.shopify.aov)
    const repeatChg = pct(current.shopify.repeatRate, previous.shopify.repeatRate)
    deltas.push({ key: 'shopify_revenue', label: 'Store revenue', current: current.shopify.revenue, previous: previous.shopify.revenue, changePct: revChg, direction: dir(revChg), isPositive: true })
    deltas.push({ key: 'shopify_aov', label: 'Average order value', current: current.shopify.aov, previous: previous.shopify.aov, changePct: aovChg, direction: dir(aovChg), isPositive: true })
    deltas.push({ key: 'shopify_repeat', label: 'Repeat customer rate', current: current.shopify.repeatRate, previous: previous.shopify.repeatRate, changePct: repeatChg, direction: dir(repeatChg), isPositive: true })
  }

  return deltas.filter(d => d.direction !== 'flat')  // only surface meaningful moves
}

// ─── Pattern detection ────────────────────────────────────────────────────────

export function detectPatterns(snapshots: { metrics: WeekMetrics }[]): PatternFlag[] {
  if (snapshots.length < 3) return []
  const flags: PatternFlag[] = []

  // Check each metric across the last 3 snapshots for consistent direction
  const checks: Array<{ key: string; label: string; extract: (m: WeekMetrics) => number | null; isPositive: boolean }> = [
    { key: 'shopify_repeat', label: 'repeat customer rate', extract: m => m.shopify?.repeatRate ?? null, isPositive: true },
    { key: 'shopify_revenue', label: 'store revenue', extract: m => m.shopify?.revenue ?? null, isPositive: true },
    { key: 'meta_cpl', label: 'Meta cost per lead', extract: m => m.metaAds?.cpl ?? null, isPositive: false },
    { key: 'meta_roas', label: 'Meta ROAS', extract: m => m.metaAds?.roas ?? null, isPositive: true },
    { key: 'gsc_clicks', label: 'organic clicks', extract: m => m.gsc?.clicks ?? null, isPositive: true },
  ]

  for (const check of checks) {
    const values = snapshots.slice(0, 3).map(s => check.extract(s.metrics)).filter((v): v is number => v !== null)
    if (values.length < 3) continue

    const allDown = values[0] > values[1] && values[1] > values[2]
    const allUp   = values[0] < values[1] && values[1] < values[2]

    if (allDown) {
      flags.push({
        key: check.key,
        description: `${check.label} has declined 3 weeks in a row`,
        weeksObserved: 3,
        direction: check.isPositive ? 'negative' : 'positive',
      })
    } else if (allUp) {
      flags.push({
        key: check.key,
        description: `${check.label} has grown 3 weeks in a row`,
        weeksObserved: 3,
        direction: check.isPositive ? 'positive' : 'negative',
      })
    }
  }

  return flags
}

// ─── Load open recommendations from AgentMemory ───────────────────────────────

async function loadOpenRecs(userId: string): Promise<OpenRecommendation[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const docs = await AgentMemory.find(
    { userId, status: 'open', timestamp: { $gte: thirtyDaysAgo } },
    { recommendation: 1, agent: 1, timestamp: 1, followUpAt: 1 }
  ).sort({ timestamp: -1 }).limit(5).lean() as {
    recommendation: string; agent: string; timestamp: string; followUpAt?: string
  }[]

  return docs.map(d => ({
    recommendation: d.recommendation,
    agent: d.agent,
    timestamp: d.timestamp.slice(0, 10),
    followUpAt: d.followUpAt,
  }))
}

// ─── LLM brief generation ─────────────────────────────────────────────────────

function buildBriefPrompt(data: BriefData): string {
  const { brandName, weekLabel, deltas, patterns, openRecs, rawMetrics } = data

  const deltaLines = deltas.map(d => {
    const arrow = d.direction === 'up' ? '↑' : '↓'
    const good = d.isPositive ? d.direction === 'up' : d.direction === 'down'
    const sentiment = good ? '(good)' : '(bad)'
    return `${arrow} ${d.label}: ${d.previous} → ${d.current} (${d.changePct > 0 ? '+' : ''}${d.changePct}%) ${sentiment}`
  }).join('\n') || 'No significant metric moves this week.'

  const patternLines = patterns.map(p =>
    `${p.direction === 'negative' ? '⚠️' : '✓'} ${p.description} [${p.weeksObserved} weeks]`
  ).join('\n') || 'No multi-week patterns detected yet.'

  const openRecLines = openRecs.map(r =>
    `- [${r.agent}] ${r.recommendation} (flagged ${r.timestamp})`
  ).join('\n') || 'None.'

  const shopifySummary = rawMetrics.current.shopify
    ? `Revenue: ${rawMetrics.current.shopify.revenue} | AOV: ${rawMetrics.current.shopify.aov} | Repeat rate: ${rawMetrics.current.shopify.repeatRate}% | Discount order share: ${rawMetrics.current.shopify.discountedOrderShare}%`
    : 'Not connected.'

  const metaSummary = rawMetrics.current.metaAds
    ? `Spend: ${rawMetrics.current.metaAds.spend} | CPL: ${rawMetrics.current.metaAds.cpl} | ROAS: ${rawMetrics.current.metaAds.roas}x | CTR: ${rawMetrics.current.metaAds.ctr}%`
    : 'Not connected.'

  return `You are Marvyn, an AI marketing advisor. Generate a weekly brief for ${brandName} — week of ${weekLabel}.

You have this business's full marketing data. Write like a senior marketer who has been watching this business for months, not a system reporting numbers.

METRIC CHANGES THIS WEEK:
${deltaLines}

MULTI-WEEK PATTERNS:
${patternLines}

SHOPIFY STORE (current week):
${shopifySummary}

META ADS (current week):
${metaSummary}

OPEN RECOMMENDATIONS (unacted, last 30 days):
${openRecLines}

INSTRUCTIONS:
- Lead each "whatChanged" item with the insight, not the number. Numbers are evidence, not headlines.
- "patterns" must explicitly say "third week in a row" or "second week" — be specific.
- "theOneThing" must be ONE specific action with a specific rationale. No vague advice.
- "stillOpen" should reference specific prior recommendations and whether the metric has moved since.
- Confidence: High = strong data signal. Medium = directional but limited data. Low = hypothesis only.
- If Shopify and Meta data both exist, connect them. Ads CPL + repeat rate tells a story. Say it.
- If data is missing for a channel, do not mention that channel. Do not apologise for missing data.

Return ONLY valid JSON — no markdown, no code block:
{
  "subject": "Subject line for the email (max 12 words, punchy, specific to this week)",
  "whatChanged": [
    "Lead with the insight. Include the number as evidence. Max 2 sentences per item.",
    "..."
  ],
  "patterns": [
    "Explicit pattern statement with weeks count. What it means for the business.",
    "..."
  ],
  "theOneThing": {
    "action": "Specific action — what exactly to do, not a category",
    "reasoning": "Why this specifically, referencing the data above",
    "confidence": "High|Medium|Low"
  },
  "stillOpen": [
    "Reference to a prior recommendation + whether data has moved since",
    "..."
  ],
  "fullSummary": "2-3 sentence narrative for the dashboard alert. Conversational, opinionated."
}`
}

async function parseBrief(raw: string): Promise<GeneratedBrief | null> {
  try {
    const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const obj = JSON.parse(clean)
    if (
      typeof obj.subject === 'string' &&
      Array.isArray(obj.whatChanged) &&
      obj.theOneThing?.action
    ) {
      return {
        subject: obj.subject,
        whatChanged: obj.whatChanged.slice(0, 5),
        patterns: obj.patterns ?? [],
        theOneThing: obj.theOneThing,
        stillOpen: obj.stillOpen ?? [],
        fullSummary: obj.fullSummary ?? '',
      }
    }
  } catch { /* fall through */ }
  return null
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface UserConnections {
  meta?: { accessToken?: string; accountId?: string }
  searchConsole?: { siteUrl?: string }
  shopify?: { accessToken?: string; shop?: string }
}

export async function buildWeeklyBriefData(
  userId: string,
  connections: UserConnections,
  brandName: string,
  weekLabel: string
): Promise<BriefData> {
  const now = new Date()
  const weekStart = daysAgo(7, now)

  // Fetch current week metrics in parallel
  const [gscNow, metaNow, shopifyNow] = await Promise.allSettled([
    fetchGscMetrics(userId, weekStart, now),
    connections.meta?.accessToken && connections.meta?.accountId
      ? fetchMetaWeekMetrics(connections.meta.accessToken, connections.meta.accountId, weekStart, now)
      : Promise.resolve(null),
    connections.shopify?.accessToken && connections.shopify?.shop
      ? fetchShopifyWeekMetrics(connections.shopify.shop, connections.shopify.accessToken, 7)
      : Promise.resolve(null),
  ])

  const current: WeekMetrics = {
    gsc: gscNow.status === 'fulfilled' ? gscNow.value : null,
    metaAds: metaNow.status === 'fulfilled' ? metaNow.value : null,
    shopify: shopifyNow.status === 'fulfilled' ? shopifyNow.value : null,
  }

  // Load last snapshot for delta computation
  const lastSnapshot = await BusinessSnapshot.findOne(
    { userId: new mongoose.Types.ObjectId(userId) },
    { metrics: 1 }
  ).sort({ weekStart: -1 }).lean() as { metrics: WeekMetrics } | null

  // Load last 3 snapshots for pattern detection
  const recentSnapshots = await BusinessSnapshot.find(
    { userId: new mongoose.Types.ObjectId(userId) },
    { metrics: 1, weekStart: 1 }
  ).sort({ weekStart: -1 }).limit(3).lean() as { metrics: WeekMetrics; weekStart: Date }[]

  // Save this week's snapshot (upsert by weekStart)
  const weekStartMidnight = new Date(weekStart)
  weekStartMidnight.setHours(0, 0, 0, 0)
  await BusinessSnapshot.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId), weekStart: weekStartMidnight },
    { $set: { metrics: current, weekEnd: now, updatedAt: now } },
    { upsert: true }
  ).catch(() => null) // non-blocking

  const deltas = computeDeltas(current, lastSnapshot?.metrics ?? null)
  const patterns = detectPatterns(recentSnapshots.map(s => ({ metrics: s.metrics })))
  const openRecs = await loadOpenRecs(userId)

  return {
    brandName,
    weekLabel,
    deltas,
    patterns,
    openRecs,
    rawMetrics: { current, previous: lastSnapshot?.metrics ?? null },
  }
}

export async function generateBrief(data: BriefData): Promise<GeneratedBrief | null> {
  const prompt = buildBriefPrompt(data)
  try {
    const raw = await llm(prompt, 'You are Marvyn, an AI marketing advisor. Return only valid JSON.', 'powerful')
    return await parseBrief(raw)
  } catch {
    return null
  }
}

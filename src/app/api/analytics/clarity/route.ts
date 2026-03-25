import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { buildLimitResponse, enforceAiBudget, estimateCostInr, getModelNameFromComplexity, recordAiUsage } from '@/lib/ai-usage'
import { getUserConnections } from '@/lib/get-user-connections'
import { fetchClarityData, parseMetrics } from '@/lib/clarity'
import { llm } from '@/lib/llm'
import { skills } from '@/lib/skills'
import mongoose from 'mongoose'

const CACHE_TTL_MS = 23 * 60 * 60 * 1000  // 23 hours
const REFRESH_MIN_MS = 60 * 60 * 1000      // 1 hour minimum before manual refresh

type ClarityDoc = {
  connections?: {
    clarity?: {
      projectId?: string
      apiToken?: string
      connectedAt?: Date
      clarityCache?: {
        data?: Record<string, unknown>
        cachedAt?: Date
      }
    }
  }
}

type ClarityInsightItem = {
  severity: 'high' | 'medium' | 'low'
  headline: string
  evidence: string
  whyItMatters: string
  fix: string
}

type ClarityDimensionRow = {
  label: string
  sessions: number
  scrollDepth: number
  engagementSecs: number
  deadClickRate: number
}

function buildFallbackInsights(
  totalSessions: number,
  byDevice: ClarityDimensionRow[] = [],
  byBrowser: ClarityDimensionRow[] = []
): ClarityInsightItem[] {
  const browserWorstDead = [...byBrowser].sort((a, b) => b.deadClickRate - a.deadClickRate)[0]
  const deviceWorstEngagement = [...byDevice].sort((a, b) => a.engagementSecs - b.engagementSecs)[0]
  const insights: ClarityInsightItem[] = []

  if (totalSessions === 0 && byBrowser.some(row => row.sessions > 0)) {
    insights.push({
      severity: 'high',
      headline: 'Tracking mismatch between dashboard totals and browser activity',
      evidence: `Overview shows 0 sessions while browser rows sum to ${byBrowser.reduce((sum, row) => sum + row.sessions, 0)} sessions.`,
      whyItMatters: 'You cannot trust landing-page behavior analysis or campaign diagnosis if the tracking baseline is inconsistent.',
      fix: 'Verify the Clarity tag on the landing page, confirm the correct project is connected, and remove any filters excluding sessions.',
    })
  }

  if (browserWorstDead && browserWorstDead.deadClickRate >= 20) {
    insights.push({
      severity: browserWorstDead.deadClickRate >= 40 ? 'high' : 'medium',
      headline: `${browserWorstDead.label} users are hitting non-working click targets`,
      evidence: `${browserWorstDead.deadClickRate}% dead click rate with ${browserWorstDead.sessions} sessions from ${browserWorstDead.label}.`,
      whyItMatters: 'Paid traffic can reach the page and still fail to convert if buttons, tabs, or navigation elements do not respond.',
      fix: `Test the landing page on ${browserWorstDead.label}, inspect primary CTA clicks, nav interactions, and any JS-dependent elements for broken behavior.`,
    })
  }

  if (deviceWorstEngagement && deviceWorstEngagement.scrollDepth >= 80 && deviceWorstEngagement.engagementSecs <= 10) {
    insights.push({
      severity: 'medium',
      headline: `${deviceWorstEngagement.label} visitors scroll but do not engage`,
      evidence: `${deviceWorstEngagement.scrollDepth}% scroll depth with only ${deviceWorstEngagement.engagementSecs}s engagement on ${deviceWorstEngagement.label}.`,
      whyItMatters: 'Users are reaching content but not finding enough value or interaction to stay, which usually hurts conversion rate.',
      fix: 'Strengthen above-the-fold messaging, surface one primary CTA early, and break long content blocks with proof points or interactive elements.',
    })
  }

  return insights.slice(0, 3)
}

function fallbackInsights(deviceData: ReturnType<typeof parseMetrics>, browserData: ReturnType<typeof parseMetrics>): ClarityInsightItem[] {
  return buildFallbackInsights(deviceData.totalSessions, deviceData.byDimension, browserData.byDimension)
}

function normalizeCachedClarityData(data: Record<string, unknown>) {
  const byDevice = Array.isArray(data.byDevice) ? data.byDevice as ClarityDimensionRow[] : []
  const byBrowser = Array.isArray(data.byBrowser) ? data.byBrowser as ClarityDimensionRow[] : []
  const overview = (data.overview || {}) as { totalSessions?: number }
  const existing = Array.isArray(data.aiInsights) ? data.aiInsights as ClarityInsightItem[] : []
  const aiInsights = existing.length > 0 ? existing : buildFallbackInsights(overview.totalSessions || 0, byDevice, byBrowser)

  return {
    ...data,
    aiInsights,
    aiInsight: aiInsights.map((item, index) => `${index + 1}. ${item.headline} — ${item.fix}`).join('\n'),
  }
}

async function fetchAndCache(userId: string, projectId: string, apiToken: string, connectedAt?: Date) {
  const [deviceRaw, browserRaw] = await Promise.all([
    fetchClarityData(projectId, apiToken, 3, 'Device'),
    fetchClarityData(projectId, apiToken, 3, 'Browser'),
  ])

  const deviceData = parseMetrics(deviceRaw, 'Device')
  const browserData = parseMetrics(browserRaw, 'Browser')

  const insightPrompt = `Analyze this user behavior data from Microsoft Clarity for a marketing website:

Total Sessions (3 days): ${deviceData.totalSessions}
Average Scroll Depth: ${deviceData.avgScrollDepth}%
Dead Click Rate: ${deviceData.deadClickRate}%
Rage Click Rate: ${deviceData.rageClickRate}%

By Device: ${JSON.stringify(deviceData.byDimension)}
By Browser: ${JSON.stringify(browserData.byDimension)}

Return valid JSON only:
{
  "insights": [
    {
      "severity": "high | medium | low",
      "headline": "short issue title",
      "evidence": "specific metric-backed observation",
      "whyItMatters": "business or conversion impact",
      "fix": "specific action to take"
    }
  ]
}

Rules:
- Maximum 3 insights
- Use actual numbers from the input
- Focus on landing-page or UX breakpoints a marketer can act on
- Do not return markdown.`

  const rawInsight = await llm(insightPrompt, skills.seoAudit, 'fast')
  const usage = estimateCostInr({
    model: getModelNameFromComplexity('fast'),
    inputText: `${insightPrompt}\n${skills.seoAudit}`,
    outputText: rawInsight,
  })
  await recordAiUsage({
    userId,
    feature: 'clarity_insights',
    model: getModelNameFromComplexity('fast'),
    estimatedInputTokens: usage.inputTokens,
    estimatedOutputTokens: usage.outputTokens,
    estimatedCostInr: usage.estimatedCostInr,
  })

  let aiInsights: ClarityInsightItem[] = []
  try {
    const match = rawInsight.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(rawInsight)
    aiInsights = Array.isArray(parsed?.insights) ? parsed.insights.slice(0, 3) : []
  } catch {}
  if (aiInsights.length === 0) {
    aiInsights = fallbackInsights(deviceData, browserData)
  }

  const responseData = {
    overview: {
      totalSessions: deviceData.totalSessions,
      avgScrollDepth: deviceData.avgScrollDepth,
      deadClickRate: deviceData.deadClickRate,
      rageClickRate: deviceData.rageClickRate,
    },
    byDevice: deviceData.byDimension,
    byBrowser: browserData.byDimension,
    connectedAt,
    aiInsights,
    aiInsight: aiInsights.map((item, index) => `${index + 1}. ${item.headline} — ${item.fix}`).join('\n'),
  }

  // Save to cache
  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    {
      $set: {
        'connections.clarity.clarityCache.data': responseData,
        'connections.clarity.clarityCache.cachedAt': new Date(),
      },
    }
  )

  return responseData
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getUserConnections()
    const forceRefresh = new URL(req.url).searchParams.get('refresh') === '1'

    await connectDB()
    const doc = await mongoose.connection.db!
      .collection('users')
      .findOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { projection: { 'connections.clarity': 1 } }
      ) as ClarityDoc | null

    const clarity = doc?.connections?.clarity
    if (!clarity?.projectId || !clarity?.apiToken) {
      return Response.json({ connected: false })
    }

    const now = new Date()
    const cachedAt = clarity.clarityCache?.cachedAt
    const cacheAgeMs = cachedAt ? now.getTime() - new Date(cachedAt).getTime() : Infinity
    const cacheValid = cacheAgeMs < CACHE_TTL_MS
    const canRefresh = cacheAgeMs > REFRESH_MIN_MS

    // Return cached data if still valid and not forcing refresh
    if (cacheValid && !forceRefresh && clarity.clarityCache?.data) {
      const normalizedCache = normalizeCachedClarityData(clarity.clarityCache.data)
      if (JSON.stringify(normalizedCache) !== JSON.stringify(clarity.clarityCache.data)) {
        await mongoose.connection.db!.collection('users').updateOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          { $set: { 'connections.clarity.clarityCache.data': normalizedCache } }
        )
      }
      return Response.json({
        connected: true,
        ...normalizedCache,
        cached: true,
        cachedAt,
        canRefresh,
      })
    }

    // Fetch fresh — enforce 1-hour minimum even on manual refresh
    if (forceRefresh && !canRefresh) {
      const normalizedCache = clarity.clarityCache?.data ? normalizeCachedClarityData(clarity.clarityCache.data) : undefined
      return Response.json({
        connected: true,
        ...normalizedCache,
        cached: true,
        cachedAt,
        canRefresh: false,
        error: 'Please wait at least 1 hour between refreshes to avoid hitting the Clarity API rate limit.',
      })
    }

    const budget = await enforceAiBudget(userId, 'clarity_insights')
    if (!budget.allowed) {
      return Response.json(buildLimitResponse(budget), { status: 429 })
    }

    const fresh = await fetchAndCache(userId, clarity.projectId, clarity.apiToken, clarity.connectedAt)
    return Response.json({
      connected: true,
      ...fresh,
      cached: false,
      cachedAt: new Date(),
      canRefresh: false,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('Not authenticated') || msg.includes('User not found')) {
      return Response.json({ connected: false })
    }
    return Response.json({ connected: true, error: msg }, { status: 502 })
  }
}

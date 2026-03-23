import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
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

async function fetchAndCache(userId: string, projectId: string, apiToken: string, connectedAt?: Date) {
  const [deviceRaw, browserRaw] = await Promise.all([
    fetchClarityData(projectId, apiToken, 3, 'Device'),
    fetchClarityData(projectId, apiToken, 3, 'Browser'),
  ])

  const deviceData = parseMetrics(deviceRaw, 'Device')
  const browserData = parseMetrics(browserRaw, 'Browser')

  const insight = await llm(
    `Analyze this user behavior data from Microsoft Clarity for a marketing website:

Total Sessions (3 days): ${deviceData.totalSessions}
Average Scroll Depth: ${deviceData.avgScrollDepth}%
Dead Click Rate: ${deviceData.deadClickRate}%
Rage Click Rate: ${deviceData.rageClickRate}%

By Device: ${JSON.stringify(deviceData.byDimension)}
By Browser: ${JSON.stringify(browserData.byDimension)}

Identify the top 3 specific UX issues and what to fix. Be specific with the numbers. Format as 3 numbered bullet points.`,
    skills.seoAudit,
    'fast'
  )

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
    aiInsight: insight,
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
      return Response.json({
        connected: true,
        ...clarity.clarityCache.data,
        cached: true,
        cachedAt,
        canRefresh,
      })
    }

    // Fetch fresh — enforce 1-hour minimum even on manual refresh
    if (forceRefresh && !canRefresh) {
      return Response.json({
        connected: true,
        ...clarity.clarityCache?.data,
        cached: true,
        cachedAt,
        canRefresh: false,
        error: 'Please wait at least 1 hour between refreshes to avoid hitting the Clarity API rate limit.',
      })
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

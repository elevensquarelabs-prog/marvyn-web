import { NextRequest } from 'next/server'
import axios from 'axios'
import { getUserConnections, makeConnectionError } from '@/lib/get-user-connections'
import { getValidGoogleToken } from '@/lib/google-auth'

interface Ga4MetricValue {
  value: string
}

interface Ga4DimensionValue {
  value: string
}

interface Ga4Row {
  dimensionValues?: Ga4DimensionValue[]
  metricValues?: Ga4MetricValue[]
}

function toNumber(value?: string) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const days = Number(sp.get('days') || '30')

  let userId: string
  let user
  try {
    ;({ user, userId } = await getUserConnections())
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const propertyId = user.connections?.ga4?.propertyId
  if (!user.connections?.ga4?.accessToken) {
    return Response.json({ connected: false, connectionError: makeConnectionError('GA4_NOT_CONNECTED') })
  }
  if (!propertyId) {
    return Response.json({
      connected: true,
      configured: false,
      needsPropertySelection: true,
      propertyId: null,
      connectionError: { ...makeConnectionError('GA4_NOT_CONNECTED'), message: 'Select a GA4 property in Settings to start reporting' },
    })
  }

  const accessToken = await getValidGoogleToken(userId, 'ga4')
  if (!accessToken) {
    return Response.json({ connected: false, connectionError: makeConnectionError('GA4_NOT_CONNECTED') })
  }

  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`
  const headers = { Authorization: `Bearer ${accessToken}` }
  const range = [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }]

  try {
    const [overviewRes, channelRes, landingPageRes, trendRes] = await Promise.all([
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
        limit: 5,
      }, { headers }),
      axios.post(endpoint, {
        dateRanges: range,
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [{ name: 'sessions' }, { name: 'conversions' }, { name: 'engagementRate' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 5,
      }, { headers }),
      axios.post(endpoint, {
        dateRanges: range,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 30,
      }, { headers }),
    ])

    const overview = overviewRes.data.totals?.[0]?.metricValues || []
    const byChannel = ((channelRes.data.rows || []) as Ga4Row[]).map((row) => ({
      label: row.dimensionValues?.[0]?.value || 'Unknown',
      sessions: toNumber(row.metricValues?.[0]?.value),
      conversions: toNumber(row.metricValues?.[1]?.value),
    }))
    const topLandingPages = ((landingPageRes.data.rows || []) as Ga4Row[]).map((row) => ({
      path: row.dimensionValues?.[0]?.value || '/',
      sessions: toNumber(row.metricValues?.[0]?.value),
      conversions: toNumber(row.metricValues?.[1]?.value),
      engagementRate: toNumber(row.metricValues?.[2]?.value) * 100,
    }))
    const trend = ((trendRes.data.rows || []) as Ga4Row[]).map((row) => ({
      date: row.dimensionValues?.[0]?.value || '',
      sessions: toNumber(row.metricValues?.[0]?.value),
    }))

    return Response.json({
      connected: true,
      configured: true,
      propertyId,
      propertyName: user.connections?.ga4?.propertyName || '',
      accountName: user.connections?.ga4?.accountName || '',
      overview: {
        sessions: toNumber(overview[0]?.value),
        users: toNumber(overview[1]?.value),
        engagedSessions: toNumber(overview[2]?.value),
        conversions: toNumber(overview[3]?.value),
        bounceRate: toNumber(overview[4]?.value) * 100,
      },
      byChannel,
      topLandingPages,
      trend,
    })
  } catch (err) {
    console.error('[analytics/ga4] failed:', err)
    return Response.json({ connected: true, configured: true, propertyId, error: 'Failed to fetch GA4 data' }, { status: 500 })
  }
}

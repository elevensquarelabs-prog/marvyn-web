import { getServerSession } from 'next-auth'
import axios from 'axios'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

type CheckResult = {
  ok: boolean
  data?: unknown
  error?: string
}

type MetricResult = {
  ok: boolean
  metric: string
  data?: unknown
  error?: string
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object') return JSON.stringify(detail)
    return error.message
  }
  return error instanceof Error ? error.message : 'Unknown error'
}

async function safeFetch<T>(fn: () => Promise<T>): Promise<CheckResult> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function fetchMetricsIndividually(
  objectId: string,
  metrics: string[],
  accessToken: string,
  extraParams: Record<string, string>
): Promise<{ supported: MetricResult[]; unsupported: MetricResult[] }> {
  const supported: MetricResult[] = []
  const unsupported: MetricResult[] = []

  for (const metric of metrics) {
    const result = await safeFetch(async () => {
      const res = await axios.get(`https://graph.facebook.com/v21.0/${objectId}/insights`, {
        params: {
          access_token: accessToken,
          metric,
          ...extraParams,
        },
      })
      return res.data
    })

    if (result.ok) {
      supported.push({ ok: true, metric, data: result.data })
    } else {
      unsupported.push({ ok: false, metric, error: result.error })
    }
  }

  return { supported, unsupported }
}

async function fetchMetricWithParams(
  objectId: string,
  metric: string,
  accessToken: string,
  extraParams: Record<string, string>
): Promise<MetricResult> {
  const result = await safeFetch(async () => {
    const res = await axios.get(`https://graph.facebook.com/v21.0/${objectId}/insights`, {
      params: {
        access_token: accessToken,
        metric,
        ...extraParams,
      },
    })
    return res.data
  })

  if (result.ok) {
    return { ok: true, metric, data: result.data }
  }

  return { ok: false, metric, error: result.error }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const user = await User.findById(session.user.id).lean() as {
    connections?: {
      facebook?: { pageId?: string; pageName?: string; pageAccessToken?: string }
      instagram?: { accountId?: string }
    }
  } | null

  const pageId = user?.connections?.facebook?.pageId
  const pageName = user?.connections?.facebook?.pageName
  const pageAccessToken = user?.connections?.facebook?.pageAccessToken
  const instagramAccountId = user?.connections?.instagram?.accountId

  if (!pageId || !pageAccessToken) {
    return Response.json(
      { error: 'Facebook page not connected. Connect a Meta page first in Settings.' },
      { status: 400 }
    )
  }

  const untilDate = new Date()
  const sinceDate = new Date(untilDate.getTime() - 7 * 24 * 60 * 60 * 1000)
  const since = sinceDate.toISOString().slice(0, 10)
  const until = untilDate.toISOString().slice(0, 10)

  const pageInfo = await safeFetch(async () => {
    const res = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
      params: {
        access_token: pageAccessToken,
        fields: 'id,name,fan_count,followers_count',
      },
    })
    return res.data
  })

  const pageInsights = await safeFetch(async () => {
    return fetchMetricsIndividually(
      pageId,
      [
        'page_impressions',
        'page_impressions_unique',
        'page_post_engagements',
        'page_engaged_users',
        'page_fans',
      ],
      pageAccessToken,
      {
        period: 'day',
        since,
        until,
      }
    )
  })

  const instagramAccount = instagramAccountId
    ? await safeFetch(async () => {
        const res = await axios.get(`https://graph.facebook.com/v21.0/${instagramAccountId}`, {
          params: {
            access_token: pageAccessToken,
            fields: 'id,username,followers_count,follows_count,media_count,profile_picture_url',
          },
        })
        return res.data
      })
    : { ok: false, error: 'Instagram business account not connected for this page.' }

  const instagramInsights = instagramAccountId
    ? await safeFetch(async () => {
        const supported: MetricResult[] = []
        const unsupported: MetricResult[] = []

        const dailyMetrics = await fetchMetricsIndividually(
          instagramAccountId,
          ['reach', 'follower_count'],
          pageAccessToken,
          {
            period: 'day',
            since,
            until,
          }
        )
        supported.push(...dailyMetrics.supported)
        unsupported.push(...dailyMetrics.unsupported)

        const totalValueMetrics = await Promise.all(
          ['profile_views', 'accounts_engaged', 'total_interactions'].map((metric) =>
            fetchMetricWithParams(instagramAccountId, metric, pageAccessToken, {
              period: 'day',
              since,
              until,
              metric_type: 'total_value',
            })
          )
        )

        for (const metricResult of totalValueMetrics) {
          if (metricResult.ok) {
            supported.push(metricResult)
          } else {
            unsupported.push(metricResult)
          }
        }

        return { supported, unsupported }
      })
    : { ok: false, error: 'Instagram business account not connected for this page.' }

  const instagramMedia = instagramAccountId
    ? await safeFetch(async () => {
        const mediaRes = await axios.get(`https://graph.facebook.com/v21.0/${instagramAccountId}/media`, {
          params: {
            access_token: pageAccessToken,
            fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
            limit: 5,
          },
        })

        const media = Array.isArray(mediaRes.data?.data) ? mediaRes.data.data : []
        const topMedia = media.slice(0, 3)

        const mediaWithInsights = await Promise.all(
          topMedia.map(async (item: { id: string; media_type?: string }) => {
            const metrics =
              item.media_type === 'VIDEO' || item.media_type === 'REELS'
                ? ['reach', 'saved', 'total_interactions', 'views']
                : ['reach', 'saved', 'total_interactions']

            const insights = await safeFetch(async () => {
              return fetchMetricsIndividually(item.id, metrics, pageAccessToken, {})
            })

            return {
              ...item,
              insights,
            }
          })
        )

        return mediaWithInsights
      })
    : { ok: false, error: 'Instagram business account not connected for this page.' }

  return Response.json({
    connected: {
      facebookPage: {
        pageId,
        pageName: pageName || '',
      },
      instagram: {
        accountId: instagramAccountId || null,
      },
    },
    requestedWindow: { since, until },
    checks: {
      pageInfo,
      pageInsights,
      instagramAccount,
      instagramInsights,
      instagramMedia,
    },
  })
}

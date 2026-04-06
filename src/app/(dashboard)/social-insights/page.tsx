'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/shared/Button'
import { BrandIcon } from '@/components/shared/BrandIcon'
import { SocialWorkspaceTabs } from '@/components/social/SocialWorkspaceTabs'

type MetricResponse = {
  ok: boolean
  metric: string
  data?: {
    data?: Array<{
      values?: Array<{ value: number; end_time?: string }>
      title?: string
      description?: string
    }>
  }
  error?: string
}

type MetaInsightsResponse = {
  connected?: {
    facebookPage?: { pageId?: string; pageName?: string }
    instagram?: { accountId?: string | null }
  }
  checks?: {
    pageInfo?: { ok: boolean; data?: Record<string, unknown> }
    pageInsights?: {
      ok: boolean
      data?: { supported?: MetricResponse[]; unsupported?: MetricResponse[] }
      error?: string
    }
    instagramAccount?: { ok: boolean; data?: Record<string, unknown>; error?: string }
    instagramInsights?: {
      ok: boolean
      data?: { supported?: MetricResponse[]; unsupported?: MetricResponse[] }
      error?: string
    }
    instagramMedia?: {
      ok: boolean
      data?: Array<Record<string, unknown>>
      error?: string
    }
  }
  error?: string
}

type LinkedInResponse = { error?: string; checks?: Record<string, unknown> }

type ConnectionsResponse = {
  connections?: Record<string, Record<string, string>>
}

type SocialPost = {
  _id: string
  platform: 'linkedin' | 'facebook' | 'instagram'
  content: string
  status: string
  createdAt?: string
  publishedAt?: string
  scheduledAt?: string
}

function compact(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${Math.round(n)}`
}

function extractMetric(
  payload: { supported?: MetricResponse[] } | undefined,
  metric: string
) {
  return payload?.supported?.find((item) => item.metric === metric)
}

function metricValues(metric?: MetricResponse) {
  const data = metric?.data?.data?.[0]
  return Array.isArray(data?.values) ? data.values : []
}

function metricTotal(metric?: MetricResponse) {
  const values = metricValues(metric)
  return values.reduce((sum, item) => sum + Number(item.value || 0), 0)
}

function metricLatest(metric?: MetricResponse) {
  const values = metricValues(metric)
  const last = values[values.length - 1]
  return Number(last?.value || 0)
}

function metricBars(metric?: MetricResponse) {
  const values = metricValues(metric)
  const max = Math.max(1, ...values.map((item) => Number(item.value || 0)))
  return values.map((item, index) => ({
    key: `${metric?.metric || 'metric'}-${index}`,
    label: item.end_time ? new Date(item.end_time).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : `${index + 1}`,
    value: Number(item.value || 0),
    height: `${Math.max(16, (Number(item.value || 0) / max) * 100)}%`,
  }))
}

function getMediaMetricValue(item: Record<string, unknown>, metric: string) {
  const insights = item.insights as { ok?: boolean; data?: { supported?: MetricResponse[] } } | undefined
  const target = insights?.data?.supported?.find((entry) => entry.metric === metric)
  const values = metricValues(target)
  return Number(values[0]?.value || 0)
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)] mb-2">{label}</p>
      <p className="text-3xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="text-xs text-[var(--text-secondary)] mt-2">{sub}</p>
    </div>
  )
}

function MetricPanel({
  title,
  value,
  tone,
  bars,
}: {
  title: string
  value: string
  tone: string
  bars: Array<{ key: string; label: string; value: number; height: string }>
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
          <p className={`text-2xl font-semibold mt-2 ${tone}`}>{value}</p>
        </div>
      </div>
      {bars.length > 0 ? (
        <div className="space-y-2">
          <div className="h-28 grid grid-cols-7 gap-2 items-end">
            {bars.map((bar) => (
              <div key={bar.key} className="flex flex-col items-center gap-2 h-full justify-end">
                <div
                  className="w-full rounded-t-xl bg-gradient-to-t from-[#DA7756] to-[#F1B39C]"
                  style={{ height: bar.height }}
                  title={`${bar.label}: ${compact(bar.value)}`}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {bars.map((bar) => (
              <p key={`${bar.key}-label`} className="text-[10px] text-center text-[var(--text-muted)]">
                {bar.label}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">No time-series data yet for this metric.</p>
      )}
    </div>
  )
}

export default function SocialInsightsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [connections, setConnections] = useState<ConnectionsResponse['connections']>({})
  const [meta, setMeta] = useState<MetaInsightsResponse | null>(null)
  const [linkedin, setLinkedin] = useState<LinkedInResponse | null>(null)
  const [posts, setPosts] = useState<SocialPost[]>([])

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [connectionsRes, metaRes, linkedinRes, postsRes] = await Promise.all([
        fetch('/api/settings/connections'),
        fetch('/api/oauth/meta/insights'),
        fetch('/api/oauth/linkedin/insights'),
        fetch('/api/social?status=published'),
      ])

      const [connectionsData, metaData, linkedinData, postsData] = await Promise.all([
        connectionsRes.json(),
        metaRes.json(),
        linkedinRes.json(),
        postsRes.json(),
      ])

      setConnections(connectionsData.connections || {})
      setMeta(metaData)
      setLinkedin(linkedinData)
      setPosts(Array.isArray(postsData.posts) ? postsData.posts : [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const pageInfo = meta?.checks?.pageInfo?.data as Record<string, unknown> | undefined
  const igAccount = meta?.checks?.instagramAccount?.data as Record<string, unknown> | undefined
  const pageInsights = meta?.checks?.pageInsights?.data
  const igInsights = meta?.checks?.instagramInsights?.data
  const igMedia = Array.isArray(meta?.checks?.instagramMedia?.data) ? meta?.checks?.instagramMedia?.data : []

  const pageReach = extractMetric(pageInsights, 'page_impressions_unique')
  const pageEngagement = extractMetric(pageInsights, 'page_post_engagements')
  const igReach = extractMetric(igInsights, 'reach')
  const igFollowerDelta = extractMetric(igInsights, 'follower_count')
  const totalAudience = Number(pageInfo?.followers_count || 0) + Number(igAccount?.followers_count || 0)
  const totalReach7d = metricTotal(pageReach) + metricTotal(igReach)
  const publishedCount = posts.length
  const topMedia = [...igMedia]
    .sort((a, b) => getMediaMetricValue(b, 'views') - getMediaMetricValue(a, 'views'))
    .slice(0, 3)
  const avgViews = topMedia.length > 0
    ? Math.round(topMedia.reduce((sum, item) => sum + getMediaMetricValue(item, 'views'), 0) / topMedia.length)
    : 0
  const totalInteractions = topMedia.reduce((sum, item) => sum + getMediaMetricValue(item, 'total_interactions'), 0)

  const metaConnected = Boolean(connections?.facebook?.pageId || connections?.instagram?.accountId)
  const linkedinConnected = Boolean(connections?.linkedin?.profileId)
  const linkedinReady = Boolean(connections?.linkedin?.pageId) && !linkedin?.error

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Social Insights</h1>
          <p className="text-xs text-[var(--text-muted)]">Performance across connected social channels</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => loadData(true)} loading={refreshing}>
          Refresh
        </Button>
      </div>

      <SocialWorkspaceTabs />

      <div className="flex-1 p-6 space-y-6">
        {loading ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-sm text-[var(--text-secondary)]">
            Loading social performance…
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Connected Channels"
                value={`${Number(metaConnected) + Number(linkedinConnected)}`}
                sub={`${metaConnected ? 'Meta' : 'Meta disconnected'} · ${linkedinConnected ? 'LinkedIn connected' : 'LinkedIn disconnected'}`}
              />
              <SummaryCard
                label="Total Audience"
                value={compact(totalAudience)}
                sub={`Facebook ${compact(Number(pageInfo?.followers_count || 0))} · Instagram ${compact(Number(igAccount?.followers_count || 0))}`}
              />
              <SummaryCard
                label="7D Reach"
                value={compact(totalReach7d)}
                sub={`Instagram ${compact(metricTotal(igReach))} · Facebook ${compact(metricTotal(pageReach))}`}
              />
              <SummaryCard
                label="Top Reel Avg Views"
                value={compact(avgViews)}
                sub={`${compact(totalInteractions)} total interactions across top 3 reels`}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Channel Health</p>
                    <p className="text-xs text-[var(--text-secondary)]">What is live now vs what is still blocked</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <BrandIcon brand="facebook" size={28} alt="Facebook" />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">Facebook Page</p>
                        <p className="text-xs text-emerald-600">Connected</p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">{String(pageInfo?.name || 'Unknown page')}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">Unique reach and post engagement are available.</p>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <BrandIcon brand="instagram" size={28} alt="Instagram" />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">Instagram</p>
                        <p className="text-xs text-emerald-600">Connected</p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">@{String(igAccount?.username || 'unknown')}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">Followers, reach, reel views, saves and total interactions are live.</p>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <BrandIcon brand="linkedin" size={28} alt="LinkedIn" background="white" />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">LinkedIn</p>
                        <p className={`text-xs ${linkedinReady ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {linkedinReady ? 'Ready' : 'Awaiting page analytics access'}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">{String(connections?.linkedin?.profileName || 'Not connected')}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      {linkedin?.error || 'Community Management API approval is still needed before page analytics can load.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Audience Snapshot</p>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-[var(--border)] p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <BrandIcon brand="facebook" size={22} alt="Facebook" />
                      <p className="text-sm font-medium text-[var(--text-primary)]">Facebook Page</p>
                    </div>
                    <p className="text-2xl font-semibold text-[var(--text-primary)]">{compact(Number(pageInfo?.followers_count || 0))}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Followers on {String(pageInfo?.name || 'your page')}</p>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <BrandIcon brand="instagram" size={22} alt="Instagram" />
                      <p className="text-sm font-medium text-[var(--text-primary)]">Instagram</p>
                    </div>
                    <p className="text-2xl font-semibold text-[var(--text-primary)]">{compact(Number(igAccount?.followers_count || 0))}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Followers · {compact(Number(igAccount?.media_count || 0))} posts published</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <MetricPanel
                title="Instagram Reach (7D)"
                value={compact(metricTotal(igReach))}
                tone="text-[#DA7756]"
                bars={metricBars(igReach)}
              />
              <MetricPanel
                title="Facebook Unique Reach (7D)"
                value={compact(metricTotal(pageReach))}
                tone="text-[#3B82F6]"
                bars={metricBars(pageReach)}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Top Instagram Content</p>
                    <p className="text-xs text-[var(--text-secondary)]">Highest-view recent reels from the connected Instagram business account</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {topMedia.length > 0 ? topMedia.map((item) => {
                    const permalink = String(item.permalink || '#')
                    return (
                      <a
                        key={String(item.id)}
                        href={permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-2xl border border-[var(--border)] p-4 hover:border-[#DA7756]/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-1">
                            {String(item.caption || 'Untitled post')}
                          </p>
                          <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                            {new Date(String(item.timestamp || Date.now())).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Views</p>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{compact(getMediaMetricValue(item, 'views'))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Reach</p>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{compact(getMediaMetricValue(item, 'reach'))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Saves</p>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{compact(getMediaMetricValue(item, 'saved'))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Interactions</p>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{compact(getMediaMetricValue(item, 'total_interactions'))}</p>
                          </div>
                        </div>
                      </a>
                    )
                  }) : (
                    <p className="text-sm text-[var(--text-secondary)]">No Instagram media insights available yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Recent Planner Output</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 mb-5">Published posts from Marvyn’s planner workflow</p>
                <div className="space-y-3">
                  {posts.slice(0, 5).map((post) => (
                    <div key={post._id} className="rounded-2xl border border-[var(--border)] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BrandIcon brand={post.platform} size={18} alt={post.platform} background={post.platform === 'linkedin' ? 'white' : undefined} />
                        <span className="text-xs capitalize text-[var(--text-secondary)]">{post.platform}</span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] line-clamp-3">{post.content}</p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-2">
                        {new Date(post.publishedAt || post.createdAt || post.scheduledAt || Date.now()).toLocaleString('en-IN')}
                      </p>
                    </div>
                  ))}
                  {posts.length === 0 && (
                    <p className="text-sm text-[var(--text-secondary)]">No published posts yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Metric Coverage</p>
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="rounded-2xl border border-[var(--border)] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)] mb-3">Facebook supported now</p>
                  <div className="flex flex-wrap gap-2">
                    {(pageInsights?.supported || []).map((metric) => (
                      <span key={metric.metric} className="px-2.5 py-1 rounded-full bg-[#DA7756]/10 text-[#DA7756] text-xs">
                        {metric.metric}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)] mb-3">Instagram supported now</p>
                  <div className="flex flex-wrap gap-2">
                    {(igInsights?.supported || []).map((metric) => (
                      <span key={metric.metric} className="px-2.5 py-1 rounded-full bg-[#DA7756]/10 text-[#DA7756] text-xs">
                        {metric.metric}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

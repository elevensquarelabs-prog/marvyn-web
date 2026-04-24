'use client'

import { useCallback, useEffect, useState } from 'react'

import { SocialWorkspaceTabs } from '@/components/social/SocialWorkspaceTabs'
import { BrandIcon } from '@/components/shared/BrandIcon'
import { Button } from '@/components/shared/Button'

type InsightPoint = {
  date: string
  label: string
  count: number
}

type PlatformSummary = {
  platform: string
  connectedChannels: number
  activeChannels: number
  scheduledPosts: number
  publishedPosts: number
  failedPosts: number
  accountNames: string[]
}

type SocialPost = {
  id: string
  content: string
  publishDate: string
  status: 'scheduled' | 'published' | 'failed' | 'draft'
  rawState: string
  platform: string
  accountName: string
  accountId: string | null
  tags: string[]
  releaseUrl: string | null
}

type InsightsResponse = {
  configured: boolean
  plannerUrl?: string
  error?: string
  summary?: {
    connectedChannels: number
    activeChannels: number
    scheduledPosts: number
    publishedPosts: number
    failedPosts: number
    publishSuccessRate: number
  }
  platformSummary?: PlatformSummary[]
  dailyPublished?: InsightPoint[]
  dailyScheduled?: InsightPoint[]
  topPublishedPosts?: SocialPost[]
  recentActivity?: SocialPost[]
  upcomingQueue?: SocialPost[]
  coverage?: string[]
}

function compact(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${Math.round(n)}`
}

function formatPlatform(platform: string) {
  return platform
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function truncateContent(content: string, length = 180) {
  const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length <= length) {
    return text
  }
  return `${text.slice(0, length).trim()}...`
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
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)] mb-2">
        {label}
      </p>
      <p className="text-3xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="text-xs text-[var(--text-secondary)] mt-2">{sub}</p>
    </div>
  )
}

function MetricPanel({
  title,
  value,
  bars,
}: {
  title: string
  value: string
  bars: InsightPoint[]
}) {
  const max = Math.max(1, ...bars.map((bar) => bar.count))

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="text-2xl font-semibold mt-2 text-[#DA7756]">{value}</p>
      {bars.length > 0 ? (
        <div className="space-y-2 mt-4">
          <div className="h-28 grid grid-cols-7 gap-2 items-end">
            {bars.map((bar) => (
              <div key={bar.date} className="flex flex-col items-center gap-2 h-full justify-end">
                <div
                  className="w-full rounded-t-xl bg-gradient-to-t from-[#DA7756] to-[#F1B39C]"
                  style={{ height: `${Math.max(16, (bar.count / max) * 100)}%` }}
                  title={`${bar.label}: ${compact(bar.count)}`}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {bars.map((bar) => (
              <p key={`${bar.date}-label`} className="text-[10px] text-center text-[var(--text-muted)]">
                {bar.label}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)] mt-4">No Postiz activity yet.</p>
      )}
    </div>
  )
}

export default function SocialInsightsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<InsightsResponse | null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const response = await fetch('/api/marvyn-social/insights', { cache: 'no-store' })
      const payload = (await response.json()) as InsightsResponse
      setData(payload)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const summary = data?.summary
  const platformSummary = data?.platformSummary || []
  const dailyPublished = data?.dailyPublished || []
  const dailyScheduled = data?.dailyScheduled || []
  const topPublishedPosts = data?.topPublishedPosts || []
  const recentActivity = data?.recentActivity || []
  const coverage = data?.coverage || []

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Social Insights</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Performance across connected social channels
          </p>
        </div>
        <Button
          onClick={() => loadData(true)}
          disabled={refreshing}
          variant="ghost"
          className="text-sm"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="px-6 py-5 space-y-5">
        <SocialWorkspaceTabs />

        {loading ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-sm text-[var(--text-secondary)]">
            Loading Postiz insights...
          </div>
        ) : data?.error ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-sm text-red-300">
            {data.error}
          </div>
        ) : !data?.configured ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-sm text-[var(--text-secondary)]">
            Marvyn Social is not configured yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryCard
                label="Connected Channels"
                value={String(summary?.connectedChannels || 0)}
                sub={`${summary?.activeChannels || 0} active inside Postiz`}
              />
              <SummaryCard
                label="30D Published"
                value={String(summary?.publishedPosts || 0)}
                sub="Published posts returned by Postiz"
              />
              <SummaryCard
                label="Queue"
                value={String(summary?.scheduledPosts || 0)}
                sub="Scheduled items still waiting in Postiz"
              />
              <SummaryCard
                label="Publish Success"
                value={`${summary?.publishSuccessRate || 0}%`}
                sub={`${summary?.failedPosts || 0} failures in the same window`}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Channel Health</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Live Postiz channel coverage by platform
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                  {platformSummary.map((platform) => (
                    <div
                      key={platform.platform}
                      className="border border-[var(--border)] rounded-2xl p-4 bg-black/10"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <BrandIcon brand={platform.platform} size={28} />
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {formatPlatform(platform.platform)}
                          </p>
                          <p className="text-[11px] text-[#DA7756]">
                            {platform.activeChannels}/{platform.connectedChannels} active channels
                          </p>
                        </div>
                      </div>
                      <p className="text-lg font-semibold text-[var(--text-primary)]">
                        {platform.accountNames.join(', ') || 'Connected channel'}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-2">
                        {platform.publishedPosts} published, {platform.scheduledPosts} queued, {platform.failedPosts} failed
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Channel Snapshot</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Postiz account and post volume by platform
                </p>
                <div className="space-y-3 mt-4">
                  {platformSummary.map((platform) => (
                    <div
                      key={`${platform.platform}-snapshot`}
                      className="border border-[var(--border)] rounded-2xl p-4 flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <BrandIcon brand={platform.platform} size={20} />
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {formatPlatform(platform.platform)}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-1">
                            {platform.accountNames.join(', ') || 'Connected channel'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold text-[var(--text-primary)]">
                          {platform.publishedPosts}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">published in 30 days</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <MetricPanel
                title="Scheduled Queue (7D)"
                value={String(dailyScheduled.reduce((sum, item) => sum + item.count, 0))}
                bars={dailyScheduled}
              />
              <MetricPanel
                title="Published Output (7D)"
                value={String(dailyPublished.reduce((sum, item) => sum + item.count, 0))}
                bars={dailyPublished}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Top Published Content</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Recent published posts pulled from Postiz
                </p>
                <div className="space-y-3 mt-4">
                  {topPublishedPosts.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">No published posts returned yet.</p>
                  ) : (
                    topPublishedPosts.map((post) => (
                      <a
                        key={post.id}
                        href={post.releaseUrl || '#'}
                        target={post.releaseUrl ? '_blank' : undefined}
                        rel={post.releaseUrl ? 'noreferrer' : undefined}
                        className="block border border-[var(--border)] rounded-2xl p-4 bg-black/10 hover:border-[#DA7756]/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <BrandIcon brand={post.platform} size={16} />
                          <span className="text-xs text-[var(--text-secondary)]">
                            {formatPlatform(post.platform)}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">{formatDate(post.publishDate)}</span>
                        </div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {truncateContent(post.content, 120)}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-2">
                          {post.accountName}
                          {post.tags.length > 0 ? ` · ${post.tags.join(', ')}` : ''}
                        </p>
                      </a>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent Planner Output</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Latest published and failed Postiz activity
                </p>
                <div className="space-y-3 mt-4">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">No recent activity returned yet.</p>
                  ) : (
                    recentActivity.map((post) => (
                      <div
                        key={`${post.id}-activity`}
                        className="border border-[var(--border)] rounded-2xl p-4 bg-black/10"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <BrandIcon brand={post.platform} size={16} />
                          <span className="text-xs text-[var(--text-secondary)]">
                            {formatPlatform(post.platform)}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full ${
                              post.status === 'published'
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : post.status === 'failed'
                                  ? 'bg-red-500/10 text-red-300'
                                  : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {post.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {truncateContent(post.content, 140)}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-2">
                          {post.accountName} · {formatDate(post.publishDate)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Metric Coverage</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                What this dashboard is reading directly from Postiz
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {coverage.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1.5 rounded-full text-xs bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-secondary)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

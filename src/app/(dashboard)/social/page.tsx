'use client'

import { useCallback, useEffect, useState } from 'react'

import { BrandIcon } from '@/components/shared/BrandIcon'
import { Button } from '@/components/shared/Button'

type SocialIntegration = {
  id: string
  name: string
  identifier: string
  picture: string | null
  disabled?: boolean
  profile?: string | null
}

type SocialPost = {
  id: string
  content: string
  publishDate: string
  status: 'scheduled' | 'published' | 'failed' | 'draft'
  platform: string
  accountName: string
  tags: string[]
  releaseUrl: string | null
}

type SocialOverviewResponse = {
  configured: boolean
  plannerUrl: string
  integrations: SocialIntegration[]
  upcomingPosts: SocialPost[]
  recentPosts: SocialPost[]
  summary: {
    connectedChannels: number
    activeChannels: number
    scheduledPosts: number
    publishedPosts: number
    failedPosts: number
  }
  error?: string
}

function SummaryCard({
  label,
  value,
  caption,
}: {
  label: string
  value: number
  caption: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">{caption}</p>
    </div>
  )
}

function ChannelRow({ integration }: { integration: SocialIntegration }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <BrandIcon brand={integration.identifier} alt={integration.identifier} size={28} rounded />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{integration.name}</p>
          <p className="text-xs text-[var(--text-muted)] truncate">
            {integration.profile ? `@${integration.profile}` : integration.identifier}
          </p>
        </div>
      </div>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
          integration.disabled
            ? 'bg-red-500/10 text-red-400'
            : 'bg-emerald-500/10 text-emerald-400'
        }`}
      >
        {integration.disabled ? 'Needs attention' : 'Connected'}
      </span>
    </div>
  )
}

function PostRow({ post }: { post: SocialPost }) {
  const statusTone =
    post.status === 'published'
      ? 'bg-emerald-500/10 text-emerald-400'
      : post.status === 'failed'
        ? 'bg-red-500/10 text-red-400'
        : 'bg-[#DA7756]/10 text-[#DA7756]'

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
              <BrandIcon brand={post.platform} alt={post.platform} size={14} rounded />
              <span className="capitalize">{post.platform}</span>
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone}`}>
              {post.status}
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--text-primary)] line-clamp-3">{post.content}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {post.accountName} • {new Date(post.publishDate).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        {post.releaseUrl ? (
          <a
            href={post.releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#DA7756] hover:underline shrink-0"
          >
            View
          </a>
        ) : null}
      </div>
    </div>
  )
}

function SocialOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="h-80 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        <div className="h-80 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
    </div>
  )
}

export default function SocialPage() {
  const [data, setData] = useState<SocialOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOverview = useCallback(async () => {
    try {
      setError('')
      const response = await fetch('/api/marvyn-social/overview', { cache: 'no-store' })
      const payload = (await response.json()) as SocialOverviewResponse
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load Marvyn Social overview')
      }
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Marvyn Social overview')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  const socialUrl =
    data?.plannerUrl || process.env.NEXT_PUBLIC_MARVYN_SOCIAL_URL || 'http://localhost:4007'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Social Planner</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Read channels and publishing activity from Marvyn Social while Postiz remains the source of truth.
          </p>
        </div>
        <Button onClick={() => window.open(socialUrl, '_blank', 'noopener,noreferrer')}>
          Open Marvyn Social
        </Button>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {loading ? <SocialOverviewSkeleton /> : null}

        {!loading && error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
            <p className="text-sm font-medium text-red-400">Marvyn Social sync failed</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{error}</p>
          </div>
        ) : null}

        {!loading && !error && data && !data.configured ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 max-w-2xl">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Marvyn Social API is not configured yet</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Add the Postiz public API key to Marvyn so this page can pull channel and post data directly from Marvyn Social.
            </p>
          </div>
        ) : null}

        {!loading && !error && data && data.configured ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Connected channels" value={data.summary.connectedChannels} caption={`${data.summary.activeChannels} active right now`} />
              <SummaryCard label="Scheduled posts" value={data.summary.scheduledPosts} caption="Next 30 days from Marvyn Social" />
              <SummaryCard label="Published posts" value={data.summary.publishedPosts} caption="Last 14 days" />
              <SummaryCard label="Failed posts" value={data.summary.failedPosts} caption="Recent publish errors to review in Postiz" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">Connected channels</h2>
                    <p className="text-xs text-[var(--text-muted)]">Directly pulled from Marvyn Social</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {data.integrations.length > 0 ? (
                    data.integrations.map((integration) => (
                      <ChannelRow key={integration.id} integration={integration} />
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">No channels connected in Marvyn Social yet.</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">Upcoming schedule</h2>
                    <p className="text-xs text-[var(--text-muted)]">Next posts queued in Marvyn Social</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {data.upcomingPosts.length > 0 ? (
                    data.upcomingPosts.map((post) => <PostRow key={post.id} post={post} />)
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">No scheduled posts in the next 30 days.</p>
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent publishing activity</h2>
                  <p className="text-xs text-[var(--text-muted)]">Published and failed posts from the last 14 days</p>
                </div>
              </div>
              <div className="space-y-3">
                {data.recentPosts.length > 0 ? (
                  data.recentPosts.map((post) => <PostRow key={post.id} post={post} />)
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">No recent published or failed posts returned by Marvyn Social.</p>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

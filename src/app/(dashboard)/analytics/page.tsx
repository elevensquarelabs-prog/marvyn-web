'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/shared/Button'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DimensionRow {
  label: string
  sessions: number
  scrollDepth: number
  engagementSecs: number
  deadClickRate: number
}

interface ClarityData {
  connected: boolean
  error?: string
  cached?: boolean
  cachedAt?: string
  canRefresh?: boolean
  overview?: {
    totalSessions: number
    avgScrollDepth: number
    deadClickRate: number
    rageClickRate: number
  }
  byDevice?: DimensionRow[]
  byBrowser?: DimensionRow[]
  aiInsights?: Array<{
    severity: 'high' | 'medium' | 'low'
    headline: string
    evidence: string
    whyItMatters: string
    fix: string
  }>
  aiInsight?: string
}

interface ConnectionsData {
  connections?: Record<string, Record<string, string>>
}

interface AdsInsightsData {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  roas: number | null
  ctr: number
  cpa: number | null
  currency?: string
  platformBreakdown?: {
    meta?: { spend: number; impressions: number }
    google?: { spend: number; impressions: number }
  }
  connected?: {
    meta?: boolean
    google?: boolean
  }
  connectionErrors?: Array<{ code?: string; message?: string }>
}

interface KeywordRecord {
  keyword?: string
  clicks?: number
  impressions?: number
  currentPosition?: number
}

interface Ga4Data {
  connected: boolean
  configured?: boolean
  needsPropertySelection?: boolean
  error?: string
  propertyName?: string
  accountName?: string
  overview?: {
    sessions: number
    users: number
    engagedSessions: number
    conversions: number
    bounceRate: number
  }
  byChannel?: Array<{
    label: string
    sessions: number
    conversions: number
  }>
  topLandingPages?: Array<{
    path: string
    sessions: number
    conversions: number
    engagementRate: number
  }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEVICE_COLORS = ['#7c3aed', '#a78bfa', '#c4b5fd', '#ede9fe']
const BROWSER_COLORS = ['#DA7756', '#e8956f', '#f0b090', '#f5c9ae']

function scrollColor(v: number) {
  if (v >= 60) return '#22c55e'
  if (v >= 30) return '#f59e0b'
  return '#ef4444'
}
function deadColor(v: number) {
  if (v < 10) return '#22c55e'
  if (v < 25) return '#f59e0b'
  return '#ef4444'
}
function rageColor(v: number) {
  if (v < 5) return '#22c55e'
  if (v < 15) return '#f59e0b'
  return '#ef4444'
}

function fmtSecs(s: number) {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${Math.round(n)}`
}

function fmtMoney(n: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'INR' ? 0 : 2,
  }).format(n)
}

function insightTone(severity: 'high' | 'medium' | 'low') {
  if (severity === 'high') return 'border-red-200 bg-red-50 text-red-700'
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub: string; color?: string
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <span className="text-base">{icon}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
      <p className="text-[10px] text-[var(--text-muted)] mt-1">{sub}</p>
    </div>
  )
}

function ScrollGauge({ label, value }: { label: string; value: number }) {
  const color = scrollColor(value)
  const data = [{ value, fill: color }]
  return (
    <div className="flex flex-col items-center">
      <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
      <div className="relative w-24 h-14">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="60%" outerRadius="100%"
            startAngle={180} endAngle={0}
            data={data}
            barSize={10}
          >
            <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'var(--surface-2)' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-sm font-bold" style={{ color }}>{value}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter()
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<{ blogPublished: number; socialPublished: number; keywords: number; campaigns: number } | null>(null)
  const [connections, setConnections] = useState<ConnectionsData | null>(null)
  const [adsInsights, setAdsInsights] = useState<AdsInsightsData | null>(null)
  const [keywords, setKeywords] = useState<KeywordRecord[]>([])
  const [ga4, setGa4] = useState<Ga4Data | null>(null)
  const [clarity, setClarity] = useState<ClarityData | null>(null)
  const [clarityLoading, setClarityLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const [blogRes, socialRes, kwRes, adsRes, adsInsightsRes, connectionsRes, ga4Res] = await Promise.all([
        fetch('/api/blog?status=published'),
        fetch('/api/social?status=published'),
        fetch('/api/seo/keywords'),
        fetch('/api/ads/campaigns'),
        fetch('/api/ads/insights'),
        fetch('/api/settings/connections'),
        fetch('/api/analytics/ga4'),
      ])
      const [blog, social, kw, ads, insights, connected, ga4Data] = await Promise.all([
        blogRes.json(), socialRes.json(), kwRes.json(), adsRes.json(), adsInsightsRes.json(), connectionsRes.json(), ga4Res.json(),
      ])
      setKeywords(kw.keywords || [])
      setAdsInsights(insights)
      setConnections(connected)
      setGa4(ga4Data)
      setStats({
        blogPublished: blog.posts?.length || 0,
        socialPublished: social.posts?.length || 0,
        keywords: kw.keywords?.length || 0,
        campaigns: ads.campaigns?.length || 0,
      })
    } catch {}
  }, [])

  const loadClarity = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    else setClarityLoading(true)
    try {
      const url = force ? '/api/analytics/clarity?refresh=1' : '/api/analytics/clarity'
      const res = await fetch(url)
      const data = await res.json()
      setClarity(data)
    } catch {
      setClarity({ connected: false })
    } finally {
      setClarityLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadStats(); loadClarity() }, [loadStats, loadClarity])

  const connectedSources = [
    { key: 'meta', label: 'Meta Ads', connected: Boolean(connections?.connections?.meta) },
    { key: 'google', label: 'Google Ads', connected: Boolean(connections?.connections?.google) },
    { key: 'searchConsole', label: 'Search Console', connected: Boolean(connections?.connections?.searchConsole) },
    { key: 'ga4', label: 'Google Analytics 4', connected: Boolean(connections?.connections?.ga4) },
    { key: 'clarity', label: 'Microsoft Clarity', connected: Boolean(connections?.connections?.clarity) },
  ]

  const missingSources = connectedSources.filter(source => !source.connected)
  const connectedCount = connectedSources.filter(source => source.connected).length
  const totalKeywordClicks = keywords.reduce((sum, kw) => sum + (kw.clicks || 0), 0)
  const totalKeywordImpressions = keywords.reduce((sum, kw) => sum + (kw.impressions || 0), 0)
  const rankedKeywords = keywords.filter(kw => typeof kw.currentPosition === 'number' && kw.currentPosition > 0)
  const avgPosition = rankedKeywords.length
    ? rankedKeywords.reduce((sum, kw) => sum + (kw.currentPosition || 0), 0) / rankedKeywords.length
    : null
  const topKeywords = [...keywords]
    .sort((a, b) => ((b.clicks || 0) + (b.impressions || 0)) - ((a.clicks || 0) + (a.impressions || 0)))
    .slice(0, 5)

  const generateSummary = async () => {
    setLoading(true)
    setSummary('')
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Give me a concise weekly marketing performance summary and 3 key recommendations based on what you know about my brand and marketing activity. Keep it to 150 words.',
        }),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'delta') { text += data.content; setSummary(text) }
          } catch {}
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-[var(--border)] shrink-0">
        <h1 className="text-sm font-semibold text-[var(--text-primary)]">Analytics</h1>
        <p className="text-xs text-[var(--text-muted)]">Combined performance overview</p>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Blog Posts Published', value: stats.blogPublished },
              { label: 'Social Posts Published', value: stats.socialPublished },
              { label: 'Keywords Tracked', value: stats.keywords },
              { label: 'Ad Campaigns', value: stats.campaigns },
            ].map(s => (
              <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* AI Summary */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">AI Weekly Summary</h2>
            <Button size="sm" variant="secondary" onClick={generateSummary} loading={loading}>
              Generate Summary
            </Button>
          </div>
          {summary ? (
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{summary}</p>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Click Generate Summary to get an AI-powered analysis of your marketing performance.</p>
          )}
        </div>

        {/* Connected sources */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Connected Data Sources</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {connectedCount === connectedSources.length
                  ? 'All core analytics sources are connected.'
                  : `${connectedCount}/${connectedSources.length} sources connected. Connect the remaining sources to complete your analytics view.`}
              </p>
            </div>
            {missingSources.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => router.push('/settings')}>
                Manage Connections
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {connectedSources.map((source) => (
              <div key={source.key} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{source.label}</p>
                  <span
                    className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                      source.connected
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {source.connected ? 'Connected' : 'Missing'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {source.connected ? 'Data available for reporting and AI analysis.' : 'Connect this source in Settings to unlock its analytics.'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Paid + Search snapshot */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Paid Traffic Snapshot</h2>
                <p className="text-sm text-[var(--text-muted)]">Live ad performance from connected Meta and Google Ads accounts.</p>
              </div>
              {(!adsInsights?.connected?.meta && !adsInsights?.connected?.google) && (
                <Button size="sm" variant="secondary" onClick={() => router.push('/settings')}>
                  Connect Ads
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                icon="₹"
                label="Ad Spend"
                value={fmtMoney(adsInsights?.spend || 0, adsInsights?.currency || 'INR')}
                sub="Across connected ad platforms"
              />
              <MetricCard
                icon="🎯"
                label="Conversions"
                value={fmtCompact(adsInsights?.conversions || 0)}
                sub="Attributed platform conversions"
              />
              <MetricCard
                icon="📈"
                label="CTR"
                value={`${(adsInsights?.ctr || 0).toFixed(1)}%`}
                sub="Blended click-through rate"
                color={(adsInsights?.ctr || 0) >= 2 ? '#22c55e' : '#f59e0b'}
              />
              <MetricCard
                icon="💸"
                label="ROAS"
                value={adsInsights?.roas ? `${adsInsights.roas.toFixed(2)}x` : '—'}
                sub="Revenue returned per ad rupee"
                color={(adsInsights?.roas || 0) >= 2 ? '#22c55e' : '#f59e0b'}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: 'Meta Ads', spend: adsInsights?.platformBreakdown?.meta?.spend || 0, impressions: adsInsights?.platformBreakdown?.meta?.impressions || 0, connected: Boolean(adsInsights?.connected?.meta) },
                { label: 'Google Ads', spend: adsInsights?.platformBreakdown?.google?.spend || 0, impressions: adsInsights?.platformBreakdown?.google?.impressions || 0, connected: Boolean(adsInsights?.connected?.google) },
              ].map((platform) => (
                <div key={platform.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{platform.label}</p>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${platform.connected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {platform.connected ? 'Live' : 'Not connected'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                    <p>Spend: {fmtMoney(platform.spend, adsInsights?.currency || 'INR')}</p>
                    <p>Impressions: {fmtCompact(platform.impressions)}</p>
                  </div>
                </div>
              ))}
            </div>

            {adsInsights?.connectionErrors && adsInsights.connectionErrors.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">Ad data needs attention</p>
                <ul className="space-y-1 text-sm text-amber-700">
                  {adsInsights.connectionErrors.slice(0, 3).map((error, index) => (
                    <li key={`${error.code}-${index}`}>{error.message || error.code}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Search Snapshot</h2>
                <p className="text-sm text-[var(--text-muted)]">Search Console and SEO keyword performance at a glance.</p>
              </div>
              {!connections?.connections?.searchConsole && (
                <Button size="sm" variant="secondary" onClick={() => router.push('/settings')}>
                  Connect Search
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon="🔎" label="Tracked Queries" value={fmtCompact(keywords.length)} sub="Keywords stored in your workspace" />
              <MetricCard icon="👀" label="Impressions" value={fmtCompact(totalKeywordImpressions)} sub="Observed search impressions" />
              <MetricCard icon="🖱️" label="Clicks" value={fmtCompact(totalKeywordClicks)} sub="Search Console clicks" />
              <MetricCard icon="🏁" label="Avg Position" value={avgPosition ? avgPosition.toFixed(1) : '—'} sub="Average ranking position" color={avgPosition && avgPosition <= 10 ? '#22c55e' : '#f59e0b'} />
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Top Queries</p>
                <button onClick={() => router.push('/seo')} className="text-xs text-[#DA7756] hover:underline">
                  Open SEO →
                </button>
              </div>
              {topKeywords.length > 0 ? (
                <div className="space-y-2">
                  {topKeywords.map((keyword, index) => (
                    <div key={`${keyword.keyword}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--text-primary)] truncate">{keyword.keyword || 'Untitled keyword'}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {keyword.clicks || 0} clicks · {keyword.impressions || 0} impressions
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {keyword.currentPosition ? `#${keyword.currentPosition}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No keyword performance data is available yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* GA4 snapshot */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Google Analytics 4</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {ga4?.propertyName
                  ? `${ga4.propertyName}${ga4.accountName ? ` · ${ga4.accountName}` : ''}`
                  : 'Traffic, channel attribution, landing pages, and conversion signals from GA4.'}
              </p>
            </div>
            {(!ga4?.connected || ga4?.needsPropertySelection) && (
              <Button size="sm" variant="secondary" onClick={() => router.push('/settings')}>
                {ga4?.connected ? 'Select Property' : 'Connect GA4'}
              </Button>
            )}
          </div>

          {!ga4?.connected && (
            <p className="text-sm text-[var(--text-muted)]">Connect GA4 in Settings to unlock session, channel, and landing-page analytics.</p>
          )}

          {ga4?.connected && ga4?.needsPropertySelection && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">GA4 property not selected</p>
              <p className="text-sm text-amber-700 mt-1">Your GA4 token is connected, but you still need to select a property in Settings.</p>
            </div>
          )}

          {ga4?.connected && ga4?.configured && ga4.overview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <MetricCard icon="📊" label="Sessions" value={fmtCompact(ga4.overview.sessions)} sub="Last 30 days" />
                <MetricCard icon="👤" label="Users" value={fmtCompact(ga4.overview.users)} sub="Total GA4 users" />
                <MetricCard icon="⚡" label="Engaged Sessions" value={fmtCompact(ga4.overview.engagedSessions)} sub="High-intent sessions" />
                <MetricCard icon="🎯" label="Conversions" value={fmtCompact(ga4.overview.conversions)} sub="Tracked GA4 conversions" />
                <MetricCard
                  icon="↩"
                  label="Bounce Rate"
                  value={`${ga4.overview.bounceRate.toFixed(1)}%`}
                  sub="Session bounce rate"
                  color={ga4.overview.bounceRate < 45 ? '#22c55e' : ga4.overview.bounceRate < 65 ? '#f59e0b' : '#ef4444'}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Top Channels</p>
                    <span className="text-xs text-[var(--text-muted)]">Source / medium</span>
                  </div>
                  {ga4.byChannel && ga4.byChannel.length > 0 ? (
                    <div className="space-y-2">
                      {ga4.byChannel.map((channel, index) => (
                        <div key={`${channel.label}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate">{channel.label}</p>
                            <p className="text-xs text-[var(--text-muted)]">{channel.conversions} conversions</p>
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">{fmtCompact(channel.sessions)} sessions</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No channel breakdown available yet.</p>
                  )}
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Top Landing Pages</p>
                    <span className="text-xs text-[var(--text-muted)]">Sessions / engagement</span>
                  </div>
                  {ga4.topLandingPages && ga4.topLandingPages.length > 0 ? (
                    <div className="space-y-2">
                      {ga4.topLandingPages.map((page, index) => (
                        <div key={`${page.path}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate">{page.path || '/'}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {page.conversions} conversions · {page.engagementRate.toFixed(1)}% engagement
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">{fmtCompact(page.sessions)} sessions</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No landing-page performance data available yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Microsoft Clarity Section ─────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: '#7c3aed' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Microsoft Clarity — Behavior Analytics</h2>
          </div>

          {/* Not connected */}
          {!clarityLoading && clarity && !clarity.connected && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Connect Microsoft Clarity</p>
                <p className="text-xs text-[var(--text-muted)]">See session recordings, scroll depth, dead clicks, and rage clicks for your website.</p>
              </div>
              <Button size="sm" onClick={() => router.push('/settings')} style={{ background: '#7c3aed', color: 'white' }}>
                Connect in Settings →
              </Button>
            </div>
          )}

          {/* Loading */}
          {clarityLoading && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 flex items-center justify-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#7c3aed] animate-pulse" />
              <span className="text-sm text-[var(--text-muted)]">Loading Clarity data…</span>
            </div>
          )}

          {/* Error state */}
          {!clarityLoading && clarity?.connected && clarity.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700">Clarity API error: {clarity.error}</p>
            </div>
          )}

          {/* Connected + data */}
          {!clarityLoading && clarity?.connected && !clarity.error && clarity.overview && (
            <div className="space-y-4">
              {/* Cache status bar */}
              {(() => {
                const cachedAt = clarity.cachedAt ? new Date(clarity.cachedAt) : null
                const ageMs = cachedAt ? Date.now() - cachedAt.getTime() : 0
                const ageHrs = Math.floor(ageMs / (1000 * 60 * 60))
                const ageMins = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60))
                const ageLabel = ageHrs > 0 ? `${ageHrs}h ${ageMins}m ago` : `${ageMins}m ago`
                const isStale = ageMs > 20 * 60 * 60 * 1000
                return (
                  <div className={`flex items-center justify-between px-4 py-2 rounded-lg text-xs border ${
                    isStale
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)]'
                  }`}>
                    <span>
                      {clarity.cached ? `Cached · Last synced ${ageLabel}` : 'Just fetched fresh data'}
                      {isStale && ' · Data may be outdated'}
                    </span>
                    <button
                      onClick={() => loadClarity(true)}
                      disabled={!clarity.canRefresh || refreshing}
                      className={`ml-4 px-2.5 py-1 rounded font-medium transition-colors ${
                        clarity.canRefresh && !refreshing
                          ? 'text-[#7c3aed] hover:bg-[#7c3aed]/10 cursor-pointer'
                          : 'text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                      }`}
                      title={!clarity.canRefresh ? 'Wait 1 hour between refreshes' : 'Fetch latest data'}
                    >
                      {refreshing ? 'Refreshing…' : '↻ Refresh'}
                    </button>
                  </div>
                )
              })()}
              {/* Behavior overview cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                  icon="👥" label="Total Sessions" sub="Last 3 days"
                  value={String(clarity.overview.totalSessions)}
                />
                <MetricCard
                  icon="📜" label="Avg Scroll Depth" sub="of page content seen"
                  value={`${clarity.overview.avgScrollDepth}%`}
                  color={scrollColor(clarity.overview.avgScrollDepth)}
                />
                <MetricCard
                  icon="💀" label="Dead Click Rate" sub="clicks on non-interactive"
                  value={`${clarity.overview.deadClickRate}%`}
                  color={deadColor(clarity.overview.deadClickRate)}
                />
                <MetricCard
                  icon="😤" label="Rage Click Rate" sub="frustrated rapid clicks"
                  value={`${clarity.overview.rageClickRate}%`}
                  color={rageColor(clarity.overview.rageClickRate)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Device Donut */}
                {clarity.byDevice && clarity.byDevice.length > 0 && (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Sessions by Device</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={clarity.byDevice}
                          dataKey="sessions"
                          nameKey="label"
                          cx="50%" cy="50%"
                          innerRadius={55} outerRadius={80}
                          paddingAngle={3}
                        >
                          {clarity.byDevice.map((_, i) => (
                            <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val, _name, props) => [
                            `${val} sessions · ${props.payload.scrollDepth}% scroll · ${fmtSecs(props.payload.engagementSecs)} engaged`,
                          ]}
                          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                        />
                        <Legend
                          formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Browser Bar */}
                {clarity.byBrowser && clarity.byBrowser.length > 0 && (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Sessions by Browser</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={clarity.byBrowser} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} width={70} />
                        <Tooltip
                          formatter={(val, _name, props) => [
                            `${val} sessions · ${fmtSecs(props.payload.engagementSecs)} engaged · ${props.payload.deadClickRate}% dead clicks`,
                          ]}
                          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                        />
                        <Bar dataKey="sessions" radius={[0, 4, 4, 0]}>
                          {clarity.byBrowser.map((row, i) => (
                            <Cell
                              key={i}
                              fill={BROWSER_COLORS[i % BROWSER_COLORS.length]}
                              fillOpacity={row.engagementSecs > 60 ? 1 : row.engagementSecs > 20 ? 0.75 : 0.5}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Scroll Depth Gauges per device */}
              {clarity.byDevice && clarity.byDevice.length > 0 && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Scroll Depth by Device</h3>
                  <div className="flex justify-around">
                    {clarity.byDevice.map(row => (
                      <ScrollGauge key={row.label} label={row.label} value={row.scrollDepth} />
                    ))}
                  </div>
                </div>
              )}

              {/* AI Behavior Insights */}
              {clarity.aiInsights && clarity.aiInsights.length > 0 && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: '#7c3aed' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <h3 className="text-xs font-semibold text-[var(--text-primary)]">AI Behavior Insights</h3>
                    </div>
                    <a
                      href="https://clarity.microsoft.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#7c3aed] hover:underline flex items-center gap-1"
                    >
                      View in Clarity →
                    </a>
                  </div>
                  <div className="space-y-3">
                    {clarity.aiInsights.map((insight, index) => (
                      <div key={`${insight.headline}-${index}`} className="border border-[var(--border)] rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{insight.headline}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">{insight.evidence}</p>
                          </div>
                          <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold uppercase border ${insightTone(insight.severity)}`}>
                            {insight.severity}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                          <div className="rounded-lg bg-[var(--surface-2)] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Why It Matters</p>
                            <p className="text-sm text-[var(--text-secondary)]">{insight.whyItMatters}</p>
                          </div>
                          <div className="rounded-lg bg-[var(--surface-2)] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Recommended Fix</p>
                            <p className="text-sm text-[var(--text-secondary)]">{insight.fix}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!clarity.aiInsights?.length && clarity.aiInsight && (
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{clarity.aiInsight}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

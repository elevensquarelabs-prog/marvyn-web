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
  aiInsight?: string
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
  const [clarity, setClarity] = useState<ClarityData | null>(null)
  const [clarityLoading, setClarityLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const [blogRes, socialRes, kwRes, adsRes] = await Promise.all([
        fetch('/api/blog?status=published'),
        fetch('/api/social?status=published'),
        fetch('/api/seo/keywords'),
        fetch('/api/ads/campaigns'),
      ])
      const [blog, social, kw, ads] = await Promise.all([
        blogRes.json(), socialRes.json(), kwRes.json(), adsRes.json(),
      ])
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
              {clarity.aiInsight && (
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
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{clarity.aiInsight}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Connect platforms notice */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Connect Platforms for Deeper Analytics</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Connect Meta Ads, Google Ads, and Search Console in{' '}
            <a href="/settings" className="text-[#DA7756] hover:underline">Settings</a>{' '}
            to see detailed spend, clicks, CTR, and conversion data.
          </p>
        </div>
      </div>
    </div>
  )
}

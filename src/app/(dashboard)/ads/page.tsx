'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/shared/Button'
import { Badge } from '@/components/shared/Badge'
import { AdsDashboard, type InsightsData } from '@/components/ads/AdsDashboard'
import { currencySymbol } from '@/lib/currency'
import { AD_PLATFORM_REGISTRY } from '@/lib/ad-platforms'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string
  name: string
  status: string
  platform: string
  objective?: string
  daily_budget?: string
  lifetime_budget?: string
}

type Tab = 'performance' | 'campaigns' | 'creative'
type RangePreset = '7D' | '14D' | '30D' | '90D'

const PRESET_DAYS: Record<RangePreset, number> = { '7D': 7, '14D': 14, '30D': 30, '90D': 90 }
const PRESETS: RangePreset[] = ['7D', '14D', '30D', '90D']
const AD_PLATFORMS = Object.keys(AD_PLATFORM_REGISTRY)
const AD_GOALS = ['awareness', 'traffic', 'leads', 'conversions', 'app installs']
const LS_RANGE_KEY = 'ads_date_range'

// ─── Date Range Picker ────────────────────────────────────────────────────────

interface DateRangeState {
  preset: RangePreset | 'custom'
  since?: string
  until?: string
}

function DateRangePicker({
  range,
  onChange,
}: {
  range: DateRangeState
  onChange: (r: DateRangeState) => void
}) {
  const [showCustom, setShowCustom] = useState(false)
  const [since, setSince] = useState(range.since ?? '')
  const [until, setUntil] = useState(range.until ?? '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowCustom(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function applyCustom() {
    if (since && until) {
      onChange({ preset: 'custom', since, until })
      setShowCustom(false)
    }
  }

  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      {PRESETS.map(p => (
        <button
          key={p}
          onClick={() => onChange({ preset: p })}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            range.preset === p
              ? 'bg-[#DA7756]/10 text-[#DA7756] border border-[#DA7756]/30'
              : 'text-[#555] hover:text-[#A0A0A0] border border-[#1E1E1E] hover:border-[#2A2A2A]'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => setShowCustom(v => !v)}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
          range.preset === 'custom'
            ? 'bg-[#DA7756]/10 text-[#DA7756] border-[#DA7756]/30'
            : 'text-[#555] hover:text-[#A0A0A0] border-[#1E1E1E] hover:border-[#2A2A2A]'
        }`}
      >
        {range.preset === 'custom' && range.since ? `${range.since} – ${range.until}` : 'Custom'}
      </button>

      {showCustom && (
        <div className="absolute top-full right-0 mt-1.5 bg-[#111] border border-[#2A2A2A] rounded-xl p-4 shadow-2xl z-50 flex items-end gap-3 min-w-[280px]">
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#555] uppercase tracking-wider">From</label>
            <input
              type="date"
              value={since}
              onChange={e => setSince(e.target.value)}
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#DA7756]/50 w-full [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#555] uppercase tracking-wider">To</label>
            <input
              type="date"
              value={until}
              onChange={e => setUntil(e.target.value)}
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#DA7756]/50 w-full [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
            />
          </div>
          <button
            onClick={applyCustom}
            className="px-3 py-1.5 bg-[#DA7756] text-white text-xs font-medium rounded-lg hover:bg-[#DA7756]/90 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdsPage() {
  const [tab, setTab] = useState<Tab>('performance')
  const [platformFilter, setPlatformFilter] = useState('all')

  // Date range — persisted in localStorage
  const [dateRange, setDateRange] = useState<DateRangeState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(LS_RANGE_KEY)
        if (stored) return JSON.parse(stored)
      } catch {}
    }
    return { preset: '30D' }
  })

  // Insights data
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  // Campaigns (raw list for Campaigns tab)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignErrors, setCampaignErrors] = useState<string[]>([])
  const [campaignConnErrors, setCampaignConnErrors] = useState<Array<{ code: string; message: string; platform: string; settingsUrl: string }>>([])
  const [campaignPlatform, setCampaignPlatform] = useState('all')

  // Ad Creative state
  const [adProduct, setAdProduct] = useState('')
  const [adAudience, setAdAudience] = useState('')
  const [adPlatform, setAdPlatform] = useState('google')
  const [adGoal, setAdGoal] = useState('leads')
  const [adUsp, setAdUsp] = useState('')
  const [generating, setGenerating] = useState(false)
  const [adOutput, setAdOutput] = useState('')

  // Persist date range
  useEffect(() => {
    try { localStorage.setItem(LS_RANGE_KEY, JSON.stringify(dateRange)) } catch {}
  }, [dateRange])

  const buildInsightsUrl = useCallback((r: DateRangeState) => {
    if (r.preset === 'custom' && r.since && r.until) {
      return `/api/ads/insights?since=${r.since}&until=${r.until}`
    }
    const days = PRESET_DAYS[r.preset as RangePreset] ?? 30
    return `/api/ads/insights?days=${days}`
  }, [])

  const loadInsights = useCallback(async (r: DateRangeState) => {
    setInsightsLoading(true)
    try {
      const res = await fetch(buildInsightsUrl(r))
      const data = await res.json()
      setInsights(data)
    } finally {
      setInsightsLoading(false)
    }
  }, [buildInsightsUrl])

  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true)
    try {
      const res = await fetch('/api/ads/campaigns')
      const data = await res.json()
      setCampaigns(data.campaigns ?? [])
      setCampaignErrors(data.errors ?? [])
      setCampaignConnErrors(data.connectionErrors ?? [])
    } finally {
      setCampaignsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => { loadInsights(dateRange) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  // Re-fetch when date range changes
  function handleRangeChange(r: DateRangeState) {
    setDateRange(r)
    loadInsights(r)
  }

  function handleRefresh() {
    loadInsights(dateRange)
    loadCampaigns()
  }

  const filteredCampaigns = campaignPlatform === 'all'
    ? campaigns
    : campaigns.filter(c => c.platform === campaignPlatform)

  const statusVariant = (status: string): 'success' | 'default' | 'danger' => {
    if (status === 'ACTIVE' || status === 'ENABLED') return 'success'
    if (status === 'PAUSED') return 'default'
    return 'danger'
  }

  async function generateAdCreative() {
    if (!adProduct) return
    setGenerating(true)
    setAdOutput('')

    const prompt = adPlatform === 'google'
      ? `Generate 5 complete Google Ads for: "${adProduct}".
Audience: ${adAudience || 'general'}. Goal: ${adGoal}. USP: ${adUsp || 'not specified'}.

For each ad:
Headline 1 (≤30 chars): ...
Headline 2 (≤30 chars): ...
Headline 3 (≤30 chars): ...
Description 1 (≤90 chars): ...
Description 2 (≤90 chars): ...
---`
      : adPlatform === 'meta'
      ? `Generate 5 Meta Ad variations for: "${adProduct}".
Audience: ${adAudience || 'general'}. Goal: ${adGoal}. USP: ${adUsp || 'not specified'}.
Use AIDA or PAS framework. Include emotional hooks.

For each ad:
Primary Text (≤125 chars for feed preview): ...
Headline (≤40 chars): ...
Description (≤30 chars): ...
CTA button: [Learn More / Shop Now / Sign Up / Get Quote / etc]
Hook type: [curiosity / social proof / benefit / problem]
---`
      : `Generate 5 LinkedIn Ads for: "${adProduct}".
Audience: ${adAudience || 'B2B professionals'}. Goal: ${adGoal}. USP: ${adUsp || 'not specified'}.

For each ad:
Headline (≤70 chars): ...
Introductory text (≤150 chars): ...
CTA: [Learn More / Register / Download / Sign Up / etc]
---`

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, skillId: 'paid-ads' }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'delta') setAdOutput(prev => prev + data.content)
          } catch {}
        }
      }
    } finally {
      setGenerating(false)
    }
  }

  const TABS = [
    { id: 'performance', label: 'Performance' },
    { id: 'campaigns', label: 'Campaigns', count: campaigns.length },
    { id: 'creative', label: 'Ad Creative' },
  ] as const

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1E1E1E] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-white">Ads</h1>
          <p className="text-xs text-[#555]">
            {insightsLoading ? 'Loading…' : insights ? `${insights.campaigns.length} campaigns tracked` : 'Ad performance dashboard'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker range={dateRange} onChange={handleRangeChange} />
          <Button size="sm" variant="secondary" onClick={handleRefresh} loading={insightsLoading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-3 flex gap-5 border-b border-[#1E1E1E] shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === t.id ? 'border-[#DA7756] text-white' : 'border-transparent text-[#555] hover:text-[#A0A0A0]'
            }`}
          >
            {t.label}
            {'count' in t && t.count > 0 && (
              <span className="text-[10px] bg-[#1E1E1E] text-[#555] px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Performance Tab ──────────────────────────────────────────────── */}
      {tab === 'performance' && (
        <AdsDashboard
          data={insights}
          loading={insightsLoading}
          platformFilter={platformFilter}
          setPlatformFilter={setPlatformFilter}
        />
      )}

      {/* ── Campaigns Tab ────────────────────────────────────────────────── */}
      {tab === 'campaigns' && (
        <div className="p-6 space-y-4">
          <div className="flex gap-4 border-b border-[#1E1E1E] pb-3">
            {[
              { key: 'all', label: 'All Platforms' },
              ...Object.values(AD_PLATFORM_REGISTRY).map(p => ({ key: p.key, label: p.label })),
            ].map(p => (
              <button
                key={p.key}
                onClick={() => setCampaignPlatform(p.key)}
                className={`text-sm capitalize border-b-2 border-transparent transition-colors pb-1 ${
                  campaignPlatform === p.key ? 'border-[#DA7756] text-white' : 'text-[#555] hover:text-[#A0A0A0]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {campaignConnErrors.map((e, i) => (
            <div key={i} className="border rounded-xl px-4 py-3 flex items-center justify-between bg-yellow-900/10 border-yellow-900/30">
              <p className="text-sm text-yellow-400">{e.message}</p>
              <a href={e.settingsUrl} className="text-xs text-yellow-400 underline hover:no-underline ml-4 shrink-0">Connect →</a>
            </div>
          ))}

          {campaignErrors.map((e, i) => (
            <div key={i} className="bg-red-900/10 border border-red-900/30 rounded-xl px-4 py-3 text-xs text-red-400">
              ⚠ {e}
            </div>
          ))}

          {campaignsLoading && (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-[#111] border border-[#1E1E1E] rounded-lg" />
              ))}
            </div>
          )}

          {!campaignsLoading && filteredCampaigns.length === 0 && campaignConnErrors.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[#555] text-sm">No campaigns found.</p>
              <p className="text-[#333] text-xs mt-1">Connect Meta Ads or Google Ads in Settings to see campaigns.</p>
              <a href="/settings" className="inline-block mt-3 text-xs text-[#DA7756] hover:underline">Go to Settings →</a>
            </div>
          )}

          {filteredCampaigns.length > 0 && (
            <div className="bg-[#111] border border-[#1E1E1E] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E1E1E]">
                    {['Campaign', 'Platform', 'Status', 'Objective', 'Budget'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-[#555] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map(c => (
                    <tr key={c.id} className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A] transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="default" className="capitalize">{c.platform}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[#A0A0A0] text-xs">{c.objective || '—'}</td>
                      <td className="px-4 py-3 text-[#A0A0A0] text-xs">
                        {(() => {
                          const sym = currencySymbol(insights?.currency ?? 'INR')
                          if (c.daily_budget) return `${sym}${(parseInt(c.daily_budget) / 100).toFixed(2)}/day`
                          if (c.lifetime_budget) return `${sym}${(parseInt(c.lifetime_budget) / 100).toFixed(2)} total`
                          return '—'
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Ad Creative Tab ──────────────────────────────────────────────── */}
      {tab === 'creative' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 shrink-0 border-r border-[#1E1E1E] p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="text-xs text-[#555] block mb-1">Platform</label>
              <div className="flex gap-1.5 flex-wrap">
                {Object.values(AD_PLATFORM_REGISTRY).map(p => (
                  <button
                    key={p.key}
                    onClick={() => setAdPlatform(p.key)}
                    className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                      adPlatform === p.key
                        ? 'bg-[#DA7756] text-white'
                        : 'bg-[#1A1A1A] text-[#A0A0A0] border border-[#2A2A2A] hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[#555] block mb-1">Goal</label>
              <select
                value={adGoal}
                onChange={e => setAdGoal(e.target.value)}
                className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none capitalize"
              >
                {AD_GOALS.map(g => <option key={g} value={g} className="bg-[#111] capitalize">{g}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#555] block mb-1">Product / offer *</label>
              <input
                value={adProduct}
                onChange={e => setAdProduct(e.target.value)}
                placeholder="e.g. AI writing tool, 14-day free trial"
                className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
              />
            </div>

            <div>
              <label className="text-xs text-[#555] block mb-1">Target audience</label>
              <input
                value={adAudience}
                onChange={e => setAdAudience(e.target.value)}
                placeholder="e.g. marketing managers, 30-50"
                className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
              />
            </div>

            <div>
              <label className="text-xs text-[#555] block mb-1">Key differentiator</label>
              <input
                value={adUsp}
                onChange={e => setAdUsp(e.target.value)}
                placeholder="e.g. 10x faster, no code needed"
                className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
              />
            </div>

            <Button onClick={generateAdCreative} loading={generating} disabled={!adProduct} className="w-full">
              Generate Ads
            </Button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {!adOutput && !generating && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-3xl mb-4">📣</div>
                <h2 className="text-base font-semibold text-white mb-2">Ad Creative Generator</h2>
                <p className="text-sm text-[#555] max-w-sm">
                  Fill in your product details and generate 5 platform-optimised ad variations ready to copy-paste.
                </p>
              </div>
            )}

            {(adOutput || generating) && (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{AD_PLATFORM_REGISTRY[adPlatform]?.label ?? adPlatform}</span>
                    {generating && (
                      <span className="flex items-center gap-1.5 text-xs text-[#DA7756]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756] animate-pulse" />
                        Generating…
                      </span>
                    )}
                  </div>
                  {adOutput && !generating && (
                    <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(adOutput)}>
                      Copy All
                    </Button>
                  )}
                </div>
                <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-6">
                  <pre className="text-sm text-[#C0C0C0] whitespace-pre-wrap font-sans leading-relaxed">
                    {adOutput}
                    {generating && <span className="inline-block w-1.5 h-4 bg-[#DA7756] animate-pulse ml-0.5 align-middle" />}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

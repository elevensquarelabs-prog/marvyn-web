'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/shared/Button'
import type { ISEOAudit } from '@/models/SEOAudit'
import AuditOverview from '@/components/seo/AuditOverview'
import IssuesPanel from '@/components/seo/IssuesPanel'
import KeywordsTable from '@/components/seo/KeywordsTable'
import CompetitorsPanel from '@/components/seo/CompetitorsPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditData = {
  _id: string
  userId: string
  domain: string
  location: string
  city?: string
  score: number | null
  scoreSource?: 'dataforseo_onpage'
  criticalCount: number
  warningCount: number
  passedCount: number
  pageData: {
    title: string
    h1: string
    description: string
    keywords: string
    onpageScore: number
    headings: string[]
  }
  organicTraffic?: number
  organicKeywords?: number
  trafficSource?: 'gsc' | 'estimated' | null
  estimatedMetrics?: ISEOAudit['estimatedMetrics']
  crawlSummary?: ISEOAudit['crawlSummary']
  crawledPages?: ISEOAudit['crawledPages']
  issues: ISEOAudit['issues']
  competitors: ISEOAudit['competitors']
  performance: ISEOAudit['performance']
  aiActions: ISEOAudit['aiActions']
  pageKeywords: ISEOAudit['pageKeywords']
  keywordOpportunities?: ISEOAudit['keywordOpportunities']
  status: 'running' | 'complete' | 'failed'
  createdAt: Date
  completedAt?: Date
}

type StepStatus = 'pending' | 'running' | 'done'

interface RunStep {
  step: number
  status: StepStatus
  message: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────


function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-900/30 text-red-300 border-red-800/40',
    warning: 'bg-yellow-900/30 text-yellow-300 border-yellow-800/40',
    info: 'bg-blue-900/30 text-blue-300 border-blue-800/40',
  }
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wide ${styles[severity] ?? styles.info}`}>
      {severity}
    </span>
  )
}


const LOCATIONS = [
  // Asia Pacific
  'India', 'Singapore', 'Australia', 'New Zealand', 'Japan', 'South Korea',
  'Hong Kong', 'Taiwan', 'Indonesia', 'Malaysia', 'Philippines', 'Thailand',
  'Vietnam', 'Bangladesh', 'Pakistan', 'Sri Lanka',
  // Middle East & Africa
  'UAE', 'Saudi Arabia', 'Egypt', 'Nigeria', 'Kenya', 'South Africa', 'Israel', 'Turkey',
  // Europe
  'United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands',
  'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark',
  'Poland', 'Portugal', 'Ireland', 'Russia',
  // Americas
  'United States', 'Canada', 'Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile',
]

const STEP_LABELS = [
  'Crawling your website',
  'Analysing competitors',
  'Checking performance',
  'Generating recommendations',
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SEOPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<'loading' | 'idle' | 'running' | 'complete'>('loading')
  const [domain, setDomain] = useState('')
  const [location, setLocation] = useState('United States')
  const [localSEO, setLocalSEO] = useState(false)
  const [city, setCity] = useState('')
  const [audit, setAudit] = useState<AuditData | null>(null)
  const [competitors, setCompetitors] = useState<AuditData['competitors']>([])
  const [steps, setSteps] = useState<RunStep[]>(
    STEP_LABELS.map((_, i) => ({ step: i + 1, status: 'pending' as StepStatus, message: STEP_LABELS[i] }))
  )
  const [elapsed, setElapsed] = useState(0)
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'keywords' | 'competitors' | 'ai-actions'>('overview')
  const [fixingIndex, setFixingIndex] = useState<number | null>(null)
  const [fixTexts, setFixTexts] = useState<Record<number, string>>({})
  const [auditLimitError, setAuditLimitError] = useState<string | null>(null)
  const [runsThisMonth, setRunsThisMonth] = useState(0)
  const [gscConnected, setGscConnected] = useState(false)
  const [gscSiteUrl, setGscSiteUrl] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [gscKeywords, setGscKeywords] = useState<{ keyword: string; source: string; position?: number; searchVolume?: number; impressions?: number; clicks?: number; difficulty?: number }[]>([])
  const [gscStats, setGscStats] = useState<{ clicks: number; impressions: number; keywords: number; avgPosition: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load existing audit + connection status on mount
  useEffect(() => {
    fetch('/api/seo/run')
      .then(r => r.json())
      .then(data => {
        setRunsThisMonth(data.runsThisMonth ?? 0)
        if (data.audit?.status === 'complete') {
          setAudit(data.audit)
          setCompetitors(data.audit.competitors ?? [])
          setPageState('complete')
        } else {
          setPageState('idle')
        }
      })
      .catch(() => setPageState('idle'))

    fetch('/api/settings/connections')
      .then(r => r.json())
      .then(data => {
        const sc = data.connections?.searchConsole
        const g = data.connections?.google
        if (sc?.siteUrl) {
          setGscConnected(true)
          setGscSiteUrl(sc.siteUrl)
        } else if (g?.connected === 'true') {
          // Token exists but no site selected yet
          setGscConnected(false)
        }
      })
      .catch(() => {})

    // Load GSC keywords from Keyword model (populated by sync)
    fetch('/api/seo/keywords')
      .then(r => r.json())
      .then(data => {
        if (data.keywords?.length) {
          const kws = data.keywords.map((k: { keyword: string; currentPosition?: number; impressions?: number; clicks?: number; difficulty?: number }) => ({
            keyword: k.keyword,
            source: 'gsc',
            position: k.currentPosition,
            impressions: k.impressions,  // GSC impressions — not search volume
            searchVolume: undefined,      // not available from GSC
            clicks: k.clicks,
            difficulty: k.difficulty,
          }))
          setGscKeywords(kws)
          const totalClicks = kws.reduce((s: number, k: { clicks?: number }) => s + (k.clicks ?? 0), 0)
          const totalImpressions = kws.reduce((s: number, k: { impressions?: number }) => s + (k.impressions ?? 0), 0)
          const withPos = kws.filter((k: { position?: number }) => k.position != null)
          const avgPos = withPos.length ? withPos.reduce((s: number, k: { position?: number }) => s + (k.position ?? 0), 0) / withPos.length : 0
          setGscStats({ clicks: totalClicks, impressions: totalImpressions, keywords: kws.length, avgPosition: Math.round(avgPos * 10) / 10 })
        }
      })
      .catch(() => {})
  }, [])

  const [syncResult, setSyncResult] = useState<{ synced: number; totalClicks: number; totalImpressions: number } | null>(null)

  const syncGSC = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const syncRes = await fetch('/api/seo/sync', { method: 'POST' }).then(r => r.json())
      if (syncRes.synced != null) setSyncResult({ synced: syncRes.synced, totalClicks: syncRes.totalClicks ?? 0, totalImpressions: syncRes.totalImpressions ?? 0 })
      // Refresh keywords from Keyword model
      const kwData = await fetch('/api/seo/keywords').then(r => r.json())
      if (kwData.keywords?.length) {
        const kws = kwData.keywords.map((k: { keyword: string; currentPosition?: number; impressions?: number; clicks?: number; difficulty?: number }) => ({
          keyword: k.keyword,
          source: 'gsc',
          position: k.currentPosition,
          impressions: k.impressions,
          searchVolume: undefined,
          clicks: k.clicks,
          difficulty: k.difficulty,
        }))
        setGscKeywords(kws)
        const totalClicks = kws.reduce((s: number, k: { clicks?: number }) => s + (k.clicks ?? 0), 0)
        const totalImpressions = kws.reduce((s: number, k: { impressions?: number }) => s + (k.impressions ?? 0), 0)
        const withPos = kws.filter((k: { position?: number }) => k.position != null)
        const avgPos = withPos.length ? withPos.reduce((s: number, k: { position?: number }) => s + (k.position ?? 0), 0) / withPos.length : 0
        setGscStats({ clicks: totalClicks, impressions: totalImpressions, keywords: kws.length, avgPosition: Math.round(avgPos * 10) / 10 })
      }
    } finally {
      setSyncing(false)
    }
  }

  const startTimer = useCallback(() => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  useEffect(() => () => stopTimer(), [stopTimer])

  const runAudit = async () => {
    const target = domain.trim().replace(/^https?:\/\//, '')
    if (!target) return

    setAuditLimitError(null)
    setPageState('running')
    setSteps(STEP_LABELS.map((_, i) => ({ step: i + 1, status: 'pending', message: STEP_LABELS[i] })))
    startTimer()

    try {
      const res = await fetch('/api/seo/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: target, location, city: localSEO ? city : undefined }),
      })

      // Rate limit response is JSON, not a stream
      if (res.status === 429) {
        stopTimer()
        const data = await res.json()
        setAuditLimitError(data.message)
        setRunsThisMonth(data.runsThisMonth ?? 0)
        setPageState('idle')
        return
      }

      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.type === 'step') {
              setSteps(prev => prev.map(s =>
                s.step === msg.step ? { ...s, status: msg.status, message: msg.message } : s
              ))
            }
            if (msg.type === 'complete') {
              stopTimer()
              setAudit(msg.audit)
              setCompetitors(msg.audit.competitors ?? [])
              setPageState('complete')
              setActiveTab('overview')
              setRunsThisMonth(prev => prev + 1)
            }
            if (msg.type === 'error') {
              stopTimer()
              alert('Audit failed: ' + msg.message)
              setPageState('idle')
            }
          } catch {}
        }
      }
    } catch (e) {
      stopTimer()
      alert('Audit failed: ' + (e instanceof Error ? e.message : 'Unknown error'))
      setPageState('idle')
    }
  }

  const toggleActionDone = async (idx: number, done: boolean) => {
    if (!audit) return
    await fetch('/api/seo/run', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionIndex: idx, done }),
    })
    setAudit(prev => {
      if (!prev) return prev
      const actions = [...prev.aiActions]
      actions[idx] = { ...actions[idx], done }
      return { ...prev, aiActions: actions }
    })
  }

  const fixWithAI = async (idx: number, issue: { title: string; recommendation: string }) => {
    setFixingIndex(idx)
    setFixTexts(prev => ({ ...prev, [idx]: '' }))
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Give me specific step-by-step implementation instructions to fix this SEO issue on ${audit?.domain}.

Site context:
- SEO score: ${audit?.score ?? 'N/A'}/100 | Performance: ${audit?.performance?.score ?? 'N/A'}/100
- ${audit?.criticalCount ?? 0} critical issues, ${audit?.warningCount ?? 0} warnings total
- Page title: "${audit?.pageData?.title ?? 'unknown'}"
- H1: "${audit?.pageData?.h1 ?? 'none'}"
- Meta description: ${audit?.pageData?.description ? `"${audit.pageData.description.slice(0, 100)}..."` : 'MISSING'}
${audit?.crawledPages?.length ? `- ${audit.crawledPages.length} pages crawled` : ''}
${audit?.keywordOpportunities?.length ? `- Top keyword opportunity: "${audit.keywordOpportunities[0]?.keyword}" (${audit.keywordOpportunities[0]?.searchVolume ?? '?'}/mo)` : ''}

Issue to fix: ${issue.title}
Current recommendation: ${issue.recommendation}

Provide domain-specific steps. Include exact code snippets or CMS instructions where relevant. 5-8 steps max.`,
        }),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'delta') {
              setFixTexts(prev => ({ ...prev, [idx]: (prev[idx] || '') + data.content }))
            }
          } catch {}
        }
      }
    } finally {
      setFixingIndex(null)
    }
  }

  const estimated = 65 // seconds total
  const remaining = Math.max(0, estimated - elapsed)
  const currentRunningStep = steps.findIndex(s => s.status === 'running') + 1

  // ── Idle View ──────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-[#DA7756] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (pageState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-[#DA7756]/20 border border-[#DA7756]/30 flex items-center justify-center text-2xl mx-auto mb-4">
              🔍
            </div>
            <h1 className="text-xl font-semibold text-white">SEO Audit</h1>
            <p className="text-sm text-[#555] mt-1">Crawl your website, find competitors, get AI recommendations</p>
          </div>

          <div className="space-y-3">
            <div>
              <input
                value={domain}
                onChange={e => {
                  // Strip protocol and trailing slash as user types
                  const val = e.target.value.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
                  setDomain(val)
                }}
                onKeyDown={e => e.key === 'Enter' && runAudit()}
                placeholder="yoursite.com or www.yoursite.com"
                className="w-full bg-[#111] border border-[#2A2A2A] rounded-xl px-4 py-3 text-base text-white placeholder-[#444] outline-none focus:border-[#DA7756]/60 text-center"
                autoFocus
              />
              <p className="text-[11px] text-[#444] text-center">Enter domain only — no https:// needed</p>
            </div>

            <div className="flex gap-2">
              <select
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="flex-1 bg-[#111] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none"
              >
                {LOCATIONS.map(l => <option key={l} className="bg-[#111]">{l}</option>)}
              </select>
              <button
                onClick={() => setLocalSEO(!localSEO)}
                className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                  localSEO ? 'bg-[#DA7756]/20 border-[#DA7756]/40 text-[#DA7756]' : 'bg-[#111] border-[#2A2A2A] text-[#555]'
                }`}
              >
                Local SEO
              </button>
            </div>

            {localSEO && (
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="City (e.g. Mumbai)"
                className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] outline-none focus:border-[#DA7756]/60"
              />
            )}

            {auditLimitError && (
              <div className="bg-yellow-900/10 border border-yellow-900/30 rounded-xl px-4 py-3 text-center">
                <p className="text-sm text-yellow-400 font-medium">Monthly audit limit reached</p>
                <p className="text-xs text-yellow-400/70 mt-1">{auditLimitError}</p>
              </div>
            )}

            <Button
              onClick={runAudit}
              disabled={!domain.trim() || !!auditLimitError}
              className="w-full py-3 text-base"
              size="lg"
            >
              Run SEO Audit
            </Button>
            <p className="text-xs text-[#444]">
              Takes ~60 seconds · {runsThisMonth}/10 audits used this month
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Running View ───────────────────────────────────────────────────────────
  if (pageState === 'running') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <p className="text-base font-medium text-white">Auditing {domain}</p>
            <p className="text-sm text-[#555] mt-1">
              {remaining > 0 ? `~${remaining}s remaining` : 'Finishing up…'}
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.step} className={`flex items-center gap-3 transition-opacity duration-300 ${
                s.status === 'pending' && s.step > currentRunningStep ? 'opacity-30' : 'opacity-100'
              }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm transition-colors ${
                  s.status === 'done' ? 'bg-green-500/20 text-green-400' :
                  s.status === 'running' ? 'bg-[#DA7756]/20' :
                  'bg-[#1A1A1A] text-[#444]'
                }`}>
                  {s.status === 'done' ? '✓' : s.status === 'running' ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DA7756] animate-pulse block" />
                  ) : s.step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${s.status === 'done' ? 'text-green-400' : s.status === 'running' ? 'text-white' : 'text-[#444]'}`}>
                    {s.message}
                  </p>
                </div>
                {s.status === 'running' && (
                  <svg className="animate-spin h-3.5 w-3.5 text-[#DA7756] shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          <div className="w-full bg-[#1A1A1A] rounded-full h-1.5">
            <div
              className="bg-[#DA7756] h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (steps.filter(s => s.status === 'done').length / 4) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Complete View ──────────────────────────────────────────────────────────
  if (!audit) return null


  const TABS = ['overview', 'issues', 'keywords', 'competitors', 'ai-actions'] as const

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1E1E1E] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-white">{audit.domain}</h1>
          <p className="text-xs text-[#555]">{audit.location}{audit.city ? ` · ${audit.city}` : ''} · {new Date(audit.createdAt).toLocaleDateString()}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => { setDomain(audit.domain); setLocation(audit.location); setPageState('idle') }}>
          Re-run audit
        </Button>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-3 flex gap-5 border-b border-[#1E1E1E] shrink-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`pb-3 text-sm capitalize border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t ? 'border-[#DA7756] text-white' : 'border-transparent text-[#555] hover:text-[#A0A0A0]'
            }`}
          >
            {t.replace('-', ' ')}
            {t === 'issues' && audit.criticalCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded-full">{audit.criticalCount}</span>
            )}
            {t === 'ai-actions' && audit.aiActions?.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-[#DA7756]/20 text-[#DA7756] px-1.5 py-0.5 rounded-full">
                {audit.aiActions.filter(a => !a.done).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <AuditOverview audit={audit} onSwitchTab={tab => setActiveTab(tab as typeof activeTab)} gscStats={gscStats ?? undefined} />
        )}

        {/* ── Issues ── */}
        {activeTab === 'issues' && (
          <IssuesPanel
            issues={audit.issues}
            criticalCount={audit.criticalCount}
            warningCount={audit.warningCount}
            passedCount={audit.passedCount}
            fixTexts={fixTexts}
            fixingIndex={fixingIndex}
            onFixWithAI={fixWithAI}
            domain={audit.domain}
          />
        )}

        {/* ── Keywords ── */}
        {activeTab === 'keywords' && (
          <>
            {syncResult != null && (
              <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <p className="text-xs text-green-400">
                  Synced <span className="font-semibold">{syncResult.synced}</span> keywords from Google Search Console
                  {syncResult.totalClicks > 0 && <> · <span className="font-semibold">{syncResult.totalClicks.toLocaleString()}</span> total clicks</>}
                  {syncResult.totalImpressions > 0 && <> · <span className="font-semibold">{syncResult.totalImpressions.toLocaleString()}</span> impressions</>}
                  {syncResult.synced === 0 && <span className="text-amber-400 ml-1">— Google has no search data for this site yet</span>}
                </p>
              </div>
            )}
            <KeywordsTable
              domain={audit.domain}
              gscConnected={gscConnected}
              gscSiteUrl={gscSiteUrl}
              syncing={syncing}
              onSync={syncGSC}
              searchConsoleKeywords={gscKeywords}
              opportunityKeywords={audit.keywordOpportunities ?? []}
              onPageKeywords={audit.pageKeywords ?? []}
            />
          </>
        )}

        {/* ── Competitors ── */}
        {activeTab === 'competitors' && (
          <CompetitorsPanel
            competitors={competitors}
            domain={audit.domain}
            onAdd={async (domain, tag) => {
              if (competitors.some(c => c.domain === domain)) return
              if (competitors.length >= 5) return
              // Optimistic placeholder while API fetches metrics
              const placeholder = { domain, tag, added: true, title: '', url: '', description: '' }
              setCompetitors(prev => [...prev, placeholder])
              const res = await fetch('/api/seo/run', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ op: 'add_competitor', domain, tag }),
              })
              const data = await res.json()
              // Replace placeholder with full data (including fetched metrics)
              if (data.competitor) {
                setCompetitors(prev => prev.map(c => c.domain === domain ? { ...placeholder, ...data.competitor } : c))
              }
            }}
            onDelete={async (domain) => {
              setCompetitors(prev => prev.filter(c => c.domain !== domain))
              await fetch('/api/seo/run', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ op: 'delete_competitor', domain }),
              })
            }}
            onTag={async (domain, tag) => {
              setCompetitors(prev => prev.map(c => c.domain === domain ? { ...c, tag } : c))
              await fetch('/api/seo/run', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ op: 'tag_competitor', domain, tag }),
              })
            }}
          />
        )}

        {/* ── AI Actions ── */}
        {activeTab === 'ai-actions' && (
          <div className="space-y-3 max-w-3xl">
            {audit.aiActions?.length === 0 && (
              <p className="text-sm text-[#555]">No AI recommendations available. Try re-running the audit.</p>
            )}
            {audit.aiActions?.map((action, idx) => {
              const effortColor: Record<string, string> = { Low: 'text-green-400', Medium: 'text-yellow-400', High: 'text-red-400' }
              const typeColor: Record<string, string> = {
                technical: 'bg-purple-900/20 text-purple-300',
                content: 'bg-blue-900/20 text-blue-300',
                keyword: 'bg-orange-900/20 text-orange-300',
                competitor: 'bg-pink-900/20 text-pink-300',
              }
              return (
                <div key={idx} className={`bg-[#111] border rounded-xl p-4 transition-opacity ${action.done ? 'opacity-50 border-[#1A1A1A]' : 'border-[#1E1E1E]'}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={action.done}
                      onChange={e => toggleActionDone(idx, e.target.checked)}
                      className="mt-1 accent-[#DA7756] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <SeverityBadge severity={action.priority} />
                        <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${typeColor[action.type] ?? 'bg-[#2A2A2A] text-[#A0A0A0]'}`}>
                          {action.type}
                        </span>
                        <span className={`text-[10px] ${effortColor[action.effort] ?? 'text-[#555]'}`}>
                          {action.effort} effort
                        </span>
                        {action.done && <span className="text-[10px] text-green-400">✓ Done</span>}
                      </div>
                      <p className="text-sm font-medium text-white mb-1">{action.title}</p>
                      <p className="text-xs text-[#555] mb-3">{action.impact}</p>
                      {!action.done && action.instructions?.length > 0 && (
                        <ol className="space-y-1.5">
                          {action.instructions.map((step, si) => (
                            <li key={si} className="flex gap-2 text-xs text-[#A0A0A0]">
                              <span className="text-[#DA7756] shrink-0 font-medium">{si + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {!action.done && action.type === 'keyword' && (
                        <button
                          onClick={() => router.push('/blog?keyword=' + encodeURIComponent(action.title))}
                          className="mt-3 text-xs text-[#DA7756] hover:underline"
                        >
                          Generate blog post →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

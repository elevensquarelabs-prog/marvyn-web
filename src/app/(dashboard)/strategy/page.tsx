'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/shared/Button'

interface BrandProfile {
  businessModel?: 'd2c_ecommerce' | 'saas' | 'services_lead_gen'
  primaryGoal?: string
  primaryConversion?: string
  averageOrderValue?: number | string
  primaryChannels?: string[]
}

interface StrategyQuestion {
  key: string
  question: string
  placeholder?: string
}

interface StrategyQuestionAnswer {
  key: string
  question: string
  answer: string
}

interface StrategyTask {
  title: string
  done: boolean
  sourcePriority?: string
  blockedByPriority?: string[]
}

interface StrategyPulse {
  day: number
  capturedAt?: string
  onTrack: string[]
  behind: string[]
  blocked: string[]
  signalDrift: string | null
  todaysFocus: string
}

interface StrategyChannel {
  channel: string
  platformRole?: string
  focus: string
  kpi: string
  cadence?: string
  outputTarget?: string
  effort?: 'low' | 'medium' | 'high'
  executionNote?: string
}

interface StrategyPlan {
  _id: string
  businessModel?: 'd2c_ecommerce' | 'saas' | 'services_lead_gen'
  primaryGoal?: string
  primaryConversion?: string
  primaryChannels?: string[]
  questionAnswers?: StrategyQuestionAnswer[]
  diagnosis?: {
    bottleneck: string
    positioningRisk: string
    channelThesis: string[]
    executionConstraints: string[]
  }
  summary: string
  northStarMetric: string
  successMetric?: {
    label: string
    target: string
  }
  priorities: Array<{
    title: string
    reason: string
    actions: string[]
  }>
  channelPlan: StrategyChannel[]
  contentIdeas: string[]
  risks: string[]
  tasks: StrategyTask[]
  priorityDependencies?: Record<string, string[]>
  pulses?: StrategyPulse[]
  customAdjustments?: string
  manualNotes?: string
  manualWins?: string
  review?: {
    actualSignal?: string
    summary?: string
    executionSummary?: string
    signalChanges?: string[]
    whatWorked?: string[]
    whatFailed?: string[]
    nextCycleFocus?: string[]
  }
  baselineSnapshot?: StrategySnapshot
  actualSnapshot?: StrategySnapshot
  generationState?: 'idle' | 'running' | 'failed'
  generationError?: string
  startDate?: string
  endDate?: string
  committedAt?: string
  completedAt?: string
  createdAt: string
  status: 'draft' | 'active' | 'completed'
}

interface StrategySnapshot {
  capturedAt?: string
  ga4Sessions?: number
  ga4Users?: number
  ga4Conversions?: number
  ga4BounceRate?: number
  organicClicks?: number
  paidSpend?: number
  paidClicks?: number
  paidConversions?: number
  paidRoas?: number | null
  paidCtr?: number
  blogCount?: number
  socialCount?: number
  completedTasks?: number
  totalTasks?: number
}

interface Ga4Data {
  connected: boolean
  configured?: boolean
  overview?: {
    sessions: number
    users: number
    engagedSessions: number
    conversions: number
    bounceRate: number
  }
}

interface AdsInsightsData {
  spend: number
  clicks: number
  conversions: number
  roas: number | null
  ctr: number
}

interface KeywordRecord {
  clicks?: number
}

type WorkspaceView = 'draft' | 'active' | 'history'

const STRATEGY_PENDING_KEY = 'marvyn_strategy_generation_pending'
const GENERATION_STAGES = [
  'Collecting brand and channel context',
  'Reviewing SEO, analytics, and prior performance',
  'Diagnosing bottlenecks and constraints',
  'Building a 30-day operating plan',
  'Critiquing and refining the draft',
] as const

const CHANNEL_THEMES: Record<string, { label: string; tint: string; border: string; chip: string }> = {
  seo:          { label: 'SEO / Search',       tint: 'bg-emerald-500/10', border: 'border-emerald-500/30', chip: 'bg-emerald-500/20 text-emerald-600' },
  'google ads': { label: 'Google Ads',         tint: 'bg-sky-500/10',     border: 'border-sky-500/30',     chip: 'bg-sky-500/20     text-sky-600'     },
  meta:         { label: 'Meta',               tint: 'bg-blue-500/10',    border: 'border-blue-500/30',    chip: 'bg-blue-500/20    text-blue-600'    },
  facebook:     { label: 'Meta',               tint: 'bg-blue-500/10',    border: 'border-blue-500/30',    chip: 'bg-blue-500/20    text-blue-600'    },
  instagram:    { label: 'Instagram',          tint: 'bg-pink-500/10',    border: 'border-pink-500/30',    chip: 'bg-pink-500/20    text-pink-600'    },
  youtube:      { label: 'YouTube',            tint: 'bg-red-500/10',     border: 'border-red-500/30',     chip: 'bg-red-500/20     text-red-600'     },
  linkedin:     { label: 'LinkedIn',           tint: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    chip: 'bg-cyan-500/20    text-cyan-600'    },
  reddit:       { label: 'Reddit / Community', tint: 'bg-orange-500/10',  border: 'border-orange-500/30',  chip: 'bg-orange-500/20  text-orange-600'  },
  twitter:      { label: 'Twitter / X',        tint: 'bg-violet-500/10',  border: 'border-violet-500/30',  chip: 'bg-violet-500/20  text-violet-600'  },
  x:            { label: 'Twitter / X',        tint: 'bg-violet-500/10',  border: 'border-violet-500/30',  chip: 'bg-violet-500/20  text-violet-600'  },
  email:        { label: 'Email / CRM',        tint: 'bg-amber-500/10',   border: 'border-amber-500/30',   chip: 'bg-amber-500/20   text-amber-600'   },
  crm:          { label: 'Email / CRM',        tint: 'bg-amber-500/10',   border: 'border-amber-500/30',   chip: 'bg-amber-500/20   text-amber-600'   },
}

function businessModelLabel(value?: string) {
  if (value === 'd2c_ecommerce') return 'D2C / Ecommerce'
  if (value === 'services_lead_gen') return 'Services / Lead Gen'
  if (value === 'saas') return 'SaaS'
  return 'Not set'
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${Math.round(n)}`
}

function signedDelta(current?: number | null, baseline?: number | null) {
  if (current == null || baseline == null) return '—'
  const diff = current - baseline
  if (diff === 0) return '0'
  if (Math.abs(diff) >= 1000) return `${diff > 0 ? '+' : ''}${fmtCompact(Math.abs(diff))}`
  return `${diff > 0 ? '+' : ''}${Math.round(diff)}`
}

function resolveChannelTheme(channel?: string) {
  const value = (channel || '').toLowerCase()
  const keys = Object.keys(CHANNEL_THEMES).sort((a, b) => b.length - a.length)
  const matchKey = keys.find(key => {
    if (key === 'x') return /\b(twitter|x\/|x\s|twitter\/x)\b/i.test(value)
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`, 'i').test(value)
  })
  const match = matchKey ? [matchKey, CHANNEL_THEMES[matchKey]] as const : undefined
  return match?.[1] || { label: channel || 'General', tint: 'bg-[var(--surface-2)]', border: 'border-[var(--border)]', chip: 'bg-[var(--surface-2)] text-[var(--text-primary)]' }
}

function effortTone(effort?: 'low' | 'medium' | 'high') {
  if (effort === 'high') return 'bg-red-500/20 text-red-600'
  if (effort === 'medium') return 'bg-amber-500/20 text-amber-600'
  return 'bg-emerald-500/20 text-emerald-600'
}

function inferActual(plan: StrategyPlan | null, data: {
  ga4: Ga4Data | null
  ads: AdsInsightsData | null
  keywords: KeywordRecord[]
  blogCount: number
  socialCount: number
}) {
  const label = `${plan?.successMetric?.label || ''} ${plan?.northStarMetric || ''}`.toLowerCase()
  const totalKeywordClicks = data.keywords.reduce((sum, kw) => sum + (kw.clicks || 0), 0)

  if (label.match(/demo|trial|signup|sign-up|lead|conversion|book/)) {
    if (data.ga4?.overview?.conversions != null) return `${fmtCompact(data.ga4.overview.conversions)} tracked conversions`
    if (data.ads?.conversions != null) return `${fmtCompact(data.ads.conversions)} ad-attributed conversions`
  }
  if (label.match(/revenue|purchase|roas/)) {
    if (data.ads?.roas != null) return `${data.ads.roas.toFixed(2)}x ROAS`
    if (data.ads?.spend != null) return `₹${Math.round(data.ads.spend)} spend tracked`
  }
  if (label.match(/traffic|organic|seo|search/)) {
    return `${fmtCompact(totalKeywordClicks)} organic clicks tracked`
  }
  if (label.match(/content|publish/)) {
    return `${data.blogCount + data.socialCount} assets published`
  }
  if (data.ga4?.overview?.sessions != null) return `${fmtCompact(data.ga4.overview.sessions)} sessions`
  return 'Connect GA4 or ads data to see live signal'
}

function buildStrategyMarkdown(plan: StrategyPlan, profile: BrandProfile) {
  return [
    '# 30-Day Marketing Strategy',
    '',
    `Business model: ${businessModelLabel(profile.businessModel)}`,
    `Primary goal: ${profile.primaryGoal || 'Not set'}`,
    `Primary conversion: ${profile.primaryConversion || 'Not set'}`,
    `Primary channels: ${(profile.primaryChannels || []).join(', ') || 'Not set'}`,
    '',
    '## Strategic Summary',
    plan.summary,
    '',
    ...(plan.diagnosis ? [
      '## Diagnosis',
      `Bottleneck: ${plan.diagnosis.bottleneck}`,
      `Positioning risk: ${plan.diagnosis.positioningRisk}`,
      '',
    ] : []),
    '## Channel Operating Board',
    ...plan.channelPlan.flatMap(channel => [
      `### ${channel.channel}`,
      `Role: ${channel.platformRole || channel.focus}`,
      `Cadence: ${channel.cadence || 'Not set'}`,
      `Output target: ${channel.outputTarget || 'Not set'}`,
      `KPI: ${channel.kpi}`,
      ...(channel.executionNote ? [`Execution note: ${channel.executionNote}`] : []),
      '',
    ]),
    '## Priorities',
    ...plan.priorities.flatMap(p => [
      `### ${p.title}`,
      p.reason,
      ...p.actions.map(a => `- ${a}`),
      '',
    ]),
    ...(plan.review ? [
      '## Review',
      `Actual signal: ${plan.review.actualSignal || 'Not set'}`,
      `Summary: ${plan.review.summary || 'Not set'}`,
      ...(plan.review.executionSummary ? [`Execution summary: ${plan.review.executionSummary}`] : []),
      '',
      ...(plan.review.signalChanges?.length ? [
        '### Signal changes',
        ...((plan.review.signalChanges || []).map(item => `- ${item}`)),
        '',
      ] : []),
      '### What worked',
      ...((plan.review.whatWorked || []).map(item => `- ${item}`)),
      '',
      '### What failed',
      ...((plan.review.whatFailed || []).map(item => `- ${item}`)),
      '',
      '### Next cycle focus',
      ...((plan.review.nextCycleFocus || []).map(item => `- ${item}`)),
    ] : []),
  ].join('\n')
}

function normalizeQuestionAnswers(input: unknown): StrategyQuestionAnswer[] {
  if (!Array.isArray(input)) return []
  return input
    .map(item => ({
      key: typeof item?.key === 'string' ? item.key : '',
      question: typeof item?.question === 'string' ? item.question : '',
      answer: typeof item?.answer === 'string' ? item.answer : '',
    }))
    .filter(item => item.key && item.answer)
}

function mergeProfileWithAnswers(profile: BrandProfile | null, answers: StrategyQuestionAnswer[]): BrandProfile {
  const map = Object.fromEntries(answers.map(item => [item.key, item.answer]))
  const channels = typeof map.primaryChannels === 'string'
    ? map.primaryChannels.split(',').map(item => item.trim()).filter(Boolean)
    : profile?.primaryChannels
  const businessModel =
    map.businessModel?.toLowerCase().includes('d2c') || map.businessModel?.toLowerCase().includes('ecommerce')
      ? 'd2c_ecommerce'
      : map.businessModel?.toLowerCase().includes('service')
        ? 'services_lead_gen'
        : map.businessModel?.toLowerCase().includes('saas')
          ? 'saas'
          : profile?.businessModel
  return {
    businessModel,
    primaryGoal: profile?.primaryGoal || map.primaryGoal || undefined,
    primaryConversion: profile?.primaryConversion || map.primaryConversion || undefined,
    averageOrderValue: profile?.averageOrderValue || map.averageOrderValue || undefined,
    primaryChannels: channels,
  }
}

function buildQuestionAnswerPayload(questions: StrategyQuestion[], values: Record<string, string>): StrategyQuestionAnswer[] {
  return questions
    .map(question => ({
      key: question.key,
      question: question.question,
      answer: (values[question.key] || '').trim(),
    }))
    .filter(item => item.answer)
}

async function safeJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url)
    const text = await res.text()
    if (!text) return fallback
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

async function safeResponseJson<T>(res: Response, fallback: T): Promise<T> {
  try {
    const text = await res.text()
    if (!text) return fallback
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

// Compact priority card — reason collapsed by default
function PriorityCard({ priority, index }: { priority: { title: string; reason: string; actions: string[] }; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DA7756]/15 text-xs font-semibold text-[#DA7756]">{index + 1}</span>
        <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{priority.title}</p>
      </div>
      <ul className="space-y-1.5 pl-9">
        {(priority.actions || []).map(action => (
          <li key={action} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
            {action}
          </li>
        ))}
      </ul>
      {priority.reason && (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="ml-9 text-left text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
        >
          {open ? 'hide rationale ↑' : 'why this? ↓'}
        </button>
      )}
      {open && priority.reason && (
        <p className="ml-9 text-xs text-[var(--text-muted)] leading-relaxed">{priority.reason}</p>
      )}
    </div>
  )
}

// Compact channel row with expandable execution note
function ChannelRow({ channel }: { channel: StrategyChannel }) {
  const [expanded, setExpanded] = useState(false)
  const theme = resolveChannelTheme(channel.channel)

  return (
    <div className={`rounded-xl border px-4 py-3 ${theme.tint} ${theme.border}`}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${theme.chip}`}>{theme.label}</span>
            <span className="min-w-0 break-words text-sm font-semibold leading-6 text-[var(--text-primary)]">
              {channel.platformRole || channel.focus}
            </span>
          </div>
          <div className="mt-2 min-w-0 break-words text-[11px] font-medium uppercase tracking-[0.12em] leading-5 text-[var(--text-secondary)]">
            {channel.kpi}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 lg:justify-self-end">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${effortTone(channel.effort)}`}>{channel.effort || 'medium'}</span>
          {channel.executionNote && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
            >
              {expanded ? 'less ↑' : 'note ↓'}
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        {channel.cadence && (
          <span className="min-w-0 break-words text-xs text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Cadence</span>
            <span className="text-[var(--text-muted)]"> · </span>
            {channel.cadence}
          </span>
        )}
        {channel.outputTarget && (
          <span className="min-w-0 break-words text-xs text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Target</span>
            <span className="text-[var(--text-muted)]"> · </span>
            {channel.outputTarget}
          </span>
        )}
      </div>
      {expanded && channel.executionNote && (
        <p className="mt-2 text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-2">{channel.executionNote}</p>
      )}
    </div>
  )
}

function ChannelBoard({ plan }: { plan: StrategyPlan }) {
  const channels = Array.isArray(plan.channelPlan) ? plan.channelPlan : []
  return (
    <section>
      <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Channel Plan</p>
      <div className="space-y-2">
        {channels.map(channel => (
          <ChannelRow key={`${plan._id}-${channel.channel}`} channel={channel} />
        ))}
      </div>
    </section>
  )
}

export default function StrategyPage() {
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [draftPlan, setDraftPlan] = useState<StrategyPlan | null>(null)
  const [activePlan, setActivePlan] = useState<StrategyPlan | null>(null)
  const [history, setHistory] = useState<StrategyPlan[]>([])
  const [questions, setQuestions] = useState<StrategyQuestion[]>([])
  const [questionValues, setQuestionValues] = useState<Record<string, string>>({})
  const [keywords, setKeywords] = useState<KeywordRecord[]>([])
  const [ga4, setGa4] = useState<Ga4Data | null>(null)
  const [ads, setAds] = useState<AdsInsightsData | null>(null)
  const [blogCount, setBlogCount] = useState(0)
  const [socialCount, setSocialCount] = useState(0)
  const [view, setView] = useState<WorkspaceView>('draft')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generationStage, setGenerationStage] = useState(0)
  const [savingDraft, setSavingDraft] = useState(false)
  const [savingCycle, setSavingCycle] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [closing, setClosing] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [preparingSummary, setPreparingSummary] = useState(false)
  const [pulseDismissed, setPulseDismissed] = useState(false)
  const [banner, setBanner] = useState('')
  const [error, setError] = useState('')
  const [draftAdjustments, setDraftAdjustments] = useState('')
  const [draftMetricLabel, setDraftMetricLabel] = useState('')
  const [draftMetricTarget, setDraftMetricTarget] = useState('')
  const [activeNotes, setActiveNotes] = useState('')
  const [activeWins, setActiveWins] = useState('')
  const [activeAdjustments, setActiveAdjustments] = useState('')
  const [activeMetricLabel, setActiveMetricLabel] = useState('')
  const [activeMetricTarget, setActiveMetricTarget] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [brandRes, planRes, kwRes, ga4Res, adsRes, blogRes, socialRes] = await Promise.all([
        safeJson<{ brand?: BrandProfile | null }>('/api/settings/brand', {}),
        safeJson<{ draftPlan?: StrategyPlan | null; activePlan?: StrategyPlan | null; history?: StrategyPlan[]; questions?: StrategyQuestion[]; questionAnswers?: StrategyQuestionAnswer[] }>('/api/strategy/plan', {}),
        safeJson<{ keywords?: KeywordRecord[] }>('/api/seo/keywords', {}),
        safeJson<Ga4Data | null>('/api/analytics/ga4', null),
        safeJson<AdsInsightsData | null>('/api/ads/insights', null),
        safeJson<{ posts?: Array<unknown> }>('/api/blog?status=published', {}),
        safeJson<{ posts?: Array<unknown> }>('/api/social?status=published', {}),
      ])

      setBrand(brandRes.brand || null)
      setDraftPlan(planRes.draftPlan || null)
      setActivePlan(planRes.activePlan || null)
      setHistory(Array.isArray(planRes.history) ? planRes.history : [])
      setQuestions(Array.isArray(planRes.questions) ? planRes.questions : [])
      setKeywords(Array.isArray(kwRes.keywords) ? kwRes.keywords : [])
      setGa4(ga4Res)
      setAds(adsRes)
      setBlogCount(Array.isArray(blogRes.posts) ? blogRes.posts.length : 0)
      setSocialCount(Array.isArray(socialRes.posts) ? socialRes.posts.length : 0)
      setDraftAdjustments(planRes.draftPlan?.customAdjustments || '')
      setDraftMetricLabel(planRes.draftPlan?.successMetric?.label || '')
      setDraftMetricTarget(planRes.draftPlan?.successMetric?.target || '')
      setActiveNotes(planRes.activePlan?.manualNotes || '')
      setActiveWins(planRes.activePlan?.manualWins || '')
      setActiveAdjustments(planRes.activePlan?.customAdjustments || '')
      setActiveMetricLabel(planRes.activePlan?.successMetric?.label || '')
      setActiveMetricTarget(planRes.activePlan?.successMetric?.target || '')
      const rawAnswers = normalizeQuestionAnswers(planRes.questionAnswers || planRes.draftPlan?.questionAnswers)
      setQuestionValues(Object.fromEntries(rawAnswers.map(item => [item.key, item.answer])))
      if (planRes.draftPlan?.generationState === 'running') {
        setGenerating(true)
      } else if (planRes.draftPlan) {
        if (typeof window !== 'undefined') window.sessionStorage.removeItem(STRATEGY_PENDING_KEY)
        setGenerating(false)
        setGenerationStage(0)
      }
      if (planRes.draftPlan?.generationState === 'failed' && planRes.draftPlan.generationError) {
        setError(planRes.draftPlan.generationError)
      }
      if (!planRes.draftPlan) {
        setGenerating(false)
        setGenerationStage(0)
      }
      if (planRes.draftPlan) setView('draft')
      else if (planRes.activePlan) setView('active')
      else if (Array.isArray(planRes.history) && planRes.history.length) setView('history')
      else setView('draft')
      setError('')
    } catch {
      setError('Strategy workspace could not load. Reload and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!generating) return
    const interval = window.setInterval(() => {
      setGenerationStage(current => (current + 1) % GENERATION_STAGES.length)
    }, 2200)
    return () => window.clearInterval(interval)
  }, [generating])

  useEffect(() => {
    if (draftPlan?.generationState !== 'running') return
    const interval = window.setInterval(() => {
      void load()
    }, 3500)
    return () => window.clearInterval(interval)
  }, [draftPlan?.generationState, load])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasPendingGeneration = () => window.sessionStorage.getItem(STRATEGY_PENDING_KEY) === '1'

    const recoverDraftIfNeeded = async () => {
      if (generating || draftPlan || !hasPendingGeneration()) return
      await load()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void recoverDraftIfNeeded()
      }
    }

    window.addEventListener('focus', recoverDraftIfNeeded)
    document.addEventListener('visibilitychange', handleVisibility)
    void recoverDraftIfNeeded()

    return () => {
      window.removeEventListener('focus', recoverDraftIfNeeded)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [draftPlan, generating, load])

  const activeCompletion = useMemo(() => {
    if (!activePlan?.tasks?.length) return 0
    return Math.round((activePlan.tasks.filter(task => task.done).length / activePlan.tasks.length) * 100)
  }, [activePlan])

  const latestPulse = useMemo(() => {
    if (!activePlan?.pulses?.length) return null
    return [...activePlan.pulses].sort((a, b) => b.day - a.day)[0]
  }, [activePlan])

  const isTaskBlocked = useMemo(() => {
    if (!activePlan) return () => false
    return (task: StrategyTask): boolean => {
      if (!task.blockedByPriority?.length) return false
      return task.blockedByPriority.some(blockingPriority =>
        activePlan.tasks.some(t => t.sourcePriority === blockingPriority && !t.done)
      )
    }
  }, [activePlan])

  const blockedTaskCount = useMemo(() => {
    if (!activePlan) return 0
    return activePlan.tasks.filter(t => !t.done && isTaskBlocked(t)).length
  }, [activePlan, isTaskBlocked])

  const activeSignal = useMemo(() => inferActual(activePlan, { ga4, ads, keywords, blogCount, socialCount }), [activePlan, ga4, ads, keywords, blogCount, socialCount])
  const activeCurrentSnapshot = useMemo<StrategySnapshot | null>(() => {
    if (!activePlan) return null
    return {
      ga4Sessions: ga4?.overview?.sessions,
      ga4Users: ga4?.overview?.users,
      ga4Conversions: ga4?.overview?.conversions,
      ga4BounceRate: ga4?.overview?.bounceRate,
      organicClicks: keywords.reduce((sum, kw) => sum + (kw.clicks || 0), 0),
      paidSpend: ads?.spend,
      paidClicks: ads?.clicks,
      paidConversions: ads?.conversions,
      paidRoas: ads?.roas ?? null,
      paidCtr: ads?.ctr,
      blogCount,
      socialCount,
      completedTasks: activePlan.tasks?.filter(task => task.done).length || 0,
      totalTasks: activePlan.tasks?.length || 0,
    }
  }, [activePlan, ga4, ads, keywords, blogCount, socialCount])
  const historySorted = useMemo(() => [...history].sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()), [history])
  const selectedDocument = view === 'draft' ? draftPlan : activePlan
  const editableQuestions = useMemo(
    () => questions.length
      ? questions
      : normalizeQuestionAnswers(draftPlan?.questionAnswers).map(item => ({
          key: item.key,
          question: item.question,
          placeholder: '',
        })),
    [questions, draftPlan]
  )
  const effectiveProfile = useMemo(() => {
    const fromPlan = draftPlan || activePlan || historySorted[0] || null
    const answerDriven = mergeProfileWithAnswers(
      {
        businessModel: brand?.businessModel || fromPlan?.businessModel,
        primaryGoal: brand?.primaryGoal || fromPlan?.primaryGoal,
        primaryConversion: brand?.primaryConversion || fromPlan?.primaryConversion,
        averageOrderValue: brand?.averageOrderValue,
        primaryChannels: (brand?.primaryChannels?.length ? brand.primaryChannels : fromPlan?.primaryChannels) || [],
      },
      normalizeQuestionAnswers(fromPlan?.questionAnswers)
    )
    return {
      ...answerDriven,
      businessModel: answerDriven.businessModel,
      primaryGoal: answerDriven.primaryGoal,
      primaryConversion: answerDriven.primaryConversion,
      primaryChannels: answerDriven.primaryChannels || [],
    }
  }, [brand, draftPlan, activePlan, historySorted])

  const generateDraft = async () => {
    setGenerating(true)
    setGenerationStage(0)
    setError('')
    setBanner('')
    try {
      if (typeof window !== 'undefined') window.sessionStorage.setItem(STRATEGY_PENDING_KEY, '1')
      const questionAnswers = buildQuestionAnswerPayload(editableQuestions, questionValues)
      const res = await fetch('/api/strategy/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customAdjustments: draftAdjustments,
          questionAnswers,
          successMetric: {
            label: draftMetricLabel || draftPlan?.successMetric?.label || '',
            target: draftMetricTarget || draftPlan?.successMetric?.target || '',
          },
        }),
      })
      const data = await safeResponseJson<{
        error?: string
        needsInput?: boolean
        questions?: StrategyQuestion[]
      }>(res, {})
      if (data.needsInput) {
        setQuestions(Array.isArray(data.questions) ? data.questions : [])
        if (typeof window !== 'undefined') window.sessionStorage.removeItem(STRATEGY_PENDING_KEY)
        setError('Answer the planning questions first so the strategy agent has enough context.')
        return
      }
      if (!res.ok) {
        if (typeof window !== 'undefined') window.sessionStorage.removeItem(STRATEGY_PENDING_KEY)
        setError(data.error || 'Strategy generation failed. Check your data connections and try again.')
        return
      }
      setBanner('Draft generated')
      await load()
    } finally {
      setGenerating(false)
      setGenerationStage(0)
    }
  }

  const saveDraft = async () => {
    if (!draftPlan) return
    setSavingDraft(true)
    setError('')
    try {
      const questionAnswers = buildQuestionAnswerPayload(editableQuestions, questionValues)
      const res = await fetch(`/api/strategy/plan/${draftPlan._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveDraft',
          customAdjustments: draftAdjustments,
          questionAnswers,
          successMetric: {
            label: draftMetricLabel || draftPlan.successMetric?.label || draftPlan.northStarMetric,
            target: draftMetricTarget || draftPlan.successMetric?.target || '',
          },
        }),
      })
      const data = await safeResponseJson<{ error?: string; plan?: StrategyPlan }>(res, {})
      if (!res.ok) { setError(data.error || 'Unable to save draft.'); return }
      if (data.plan) setDraftPlan(data.plan)
      setBanner('Draft saved')
    } finally {
      setSavingDraft(false)
    }
  }

  const commitDraft = async () => {
    if (!draftPlan) return
    setCommitting(true)
    setError('')
    try {
      const questionAnswers = buildQuestionAnswerPayload(editableQuestions, questionValues)
      const res = await fetch(`/api/strategy/plan/${draftPlan._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'commit',
          customAdjustments: draftAdjustments,
          questionAnswers,
          successMetric: {
            label: draftMetricLabel || draftPlan.successMetric?.label || draftPlan.northStarMetric,
            target: draftMetricTarget || draftPlan.successMetric?.target || '',
          },
        }),
      })
      const data = await safeResponseJson<{ error?: string }>(res, {})
      if (!res.ok) { setError(data.error || 'Unable to commit.'); return }
      setBanner('Strategy committed — 30-day cycle is live.')
      await load()
      setView('active')
    } finally {
      setCommitting(false)
    }
  }

  const closeCycle = async () => {
    if (!activePlan) return
    setClosing(true)
    setError('')
    try {
      const res = await fetch(`/api/strategy/plan/${activePlan._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          actualSignal: activeSignal,
          manualNotes: activeNotes,
          manualWins: activeWins,
          customAdjustments: activeAdjustments,
          tasks: activePlan.tasks,
          successMetric: {
            label: activeMetricLabel || activePlan.successMetric?.label || activePlan.northStarMetric,
            target: activeMetricTarget || activePlan.successMetric?.target || '',
          },
        }),
      })
      const data = await safeResponseJson<{ error?: string }>(res, {})
      if (!res.ok) { setError(data.error || 'Unable to close cycle.'); return }
      setBanner('Cycle closed.')
      await load()
      setView('history')
    } finally {
      setClosing(false)
    }
  }

  const saveActive = async () => {
    if (!activePlan) return
    setSavingCycle(true)
    setError('')
    try {
      const res = await fetch(`/api/strategy/plan/${activePlan._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveActive',
          manualNotes: activeNotes,
          manualWins: activeWins,
          customAdjustments: activeAdjustments,
          tasks: activePlan.tasks,
          successMetric: {
            label: activeMetricLabel || activePlan.successMetric?.label || activePlan.northStarMetric,
            target: activeMetricTarget || activePlan.successMetric?.target || '',
          },
        }),
      })
      const data = await safeResponseJson<{ error?: string; plan?: StrategyPlan }>(res, {})
      if (!res.ok) { setError(data.error || 'Unable to save.'); return }
      if (data.plan) setActivePlan(data.plan)
      setBanner('Saved')
    } finally {
      setSavingCycle(false)
    }
  }

  const toggleTask = async (index: number) => {
    if (!activePlan) return
    const tasks = activePlan.tasks.map((task, i) => i === index ? { ...task, done: !task.done } : task)
    setActivePlan({ ...activePlan, tasks })
    try {
      const res = await fetch(`/api/strategy/plan/${activePlan._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveActive', tasks }),
      })
      const data = await safeResponseJson<{ plan?: StrategyPlan }>(res, {})
      if (res.ok && data.plan) setActivePlan(data.plan)
    } catch {
      setActivePlan(activePlan)
    }
  }

  const handleCopy = async () => {
    if (!selectedDocument) return
    await navigator.clipboard.writeText(buildStrategyMarkdown(selectedDocument, effectiveProfile))
    setCopyState('copied')
    setTimeout(() => setCopyState('idle'), 1500)
  }

  const handleDownload = () => {
    if (!selectedDocument) return
    const blob = new Blob([buildStrategyMarkdown(selectedDocument, effectiveProfile)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `marvyn-strategy-${selectedDocument.status}-${new Date().toISOString().slice(0, 10)}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const generateSummary = async () => {
    if (!activePlan) return
    setPreparingSummary(true)
    setError('')
    try {
      const res = await fetch(`/api/strategy/plan/${activePlan._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prepareSummary' }),
      })
      const data = await safeResponseJson<{ error?: string; preFill?: { wins: string; blockers: string; adjustments: string } }>(res, {})
      if (!res.ok) { setError(data.error || 'Unable to generate summary.'); return }
      if (data.preFill) {
        setActiveWins(data.preFill.wins)
        setActiveNotes(data.preFill.blockers)
        setActiveAdjustments(data.preFill.adjustments)
        setBanner('Summary pre-filled — review and edit before closing.')
      }
    } finally {
      setPreparingSummary(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--border)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">Strategy</h1>
            <p className="text-xs text-[var(--text-muted)]">30-day operating cycle · Draft → Commit → Execute → Close</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
              {(['draft', 'active', 'history'] as WorkspaceView[]).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setView(tab)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    view === tab
                      ? 'bg-[#DA7756] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab === 'draft' ? 'Draft' : tab === 'active' ? 'Active' : 'History'}
                </button>
              ))}
            </div>
            {selectedDocument && (
              <>
                <Button variant="secondary" onClick={handleCopy}>{copyState === 'copied' ? 'Copied' : 'Copy'}</Button>
                <Button variant="secondary" onClick={handleDownload}>Export</Button>
              </>
            )}
          </div>
        </div>

        {/* Context pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {effectiveProfile.businessModel && (
            <span className="rounded-full border border-[#DA7756]/20 bg-[#DA7756]/8 px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
              {businessModelLabel(effectiveProfile.businessModel)}
            </span>
          )}
          {effectiveProfile.primaryGoal && (
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)]">
              Goal: {effectiveProfile.primaryGoal}
            </span>
          )}
          {effectiveProfile.primaryConversion && (
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)]">
              Convert: {effectiveProfile.primaryConversion}
            </span>
          )}
          {effectiveProfile.primaryChannels?.map(ch => (
            <span key={ch} className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${resolveChannelTheme(ch).chip}`}>
              {ch}
            </span>
          ))}
        </div>

        {(banner || error) && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${error ? 'border-red-500/30 bg-red-500/10 text-red-600' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'}`}>
            {error || banner}
          </div>
        )}
      </div>

      <div className="flex-1 p-6">
        {loading ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">Loading…</div>
        ) : (
          <>
            {/* ── DRAFT VIEW ── */}
            {view === 'draft' && (
              <div className="space-y-5">
                {editableQuestions.length > 0 && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                    <div className="mb-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Agent Intake</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">Answer the missing strategy questions first. These become the planning constraints the strategy agent will reason over.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {editableQuestions.map(question => (
                        <div key={question.key} className={question.key === 'teamCapacity' ? 'lg:col-span-2' : ''}>
                          <label className="mb-1.5 block text-xs text-[var(--text-muted)]">{question.question}</label>
                          {question.key === 'teamCapacity' ? (
                            <textarea
                              value={questionValues[question.key] || ''}
                              onChange={e => setQuestionValues(state => ({ ...state, [question.key]: e.target.value }))}
                              rows={3}
                              placeholder={question.placeholder}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none"
                            />
                          ) : (
                            <input
                              value={questionValues[question.key] || ''}
                              onChange={e => setQuestionValues(state => ({ ...state, [question.key]: e.target.value }))}
                              placeholder={question.placeholder}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!draftPlan || draftPlan.generationState === 'running' ? (
                  /* Empty state */
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">No draft yet</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {draftPlan?.generationState === 'running'
                        ? 'Your draft is being generated and saved. Marvyn will keep checking for the finished result.'
                        : 'Generate a draft only after the intake answers feel right. The agent will diagnose first, then plan, then critique.'}
                    </p>
                    {generating && (
                      <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-[#DA7756]/20 bg-[#DA7756]/5 px-5 py-4 text-left">
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-4 rounded-full border-2 border-[#DA7756]/30 border-t-[#DA7756] animate-spin" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">Marvyn is building your strategy draft</p>
                            <p className="text-xs text-[var(--text-muted)]">{GENERATION_STAGES[generationStage]}</p>
                          </div>
                        </div>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                          <div
                            className="h-full rounded-full bg-[#DA7756] transition-all duration-700"
                            style={{ width: `${((generationStage + 1) / GENERATION_STAGES.length) * 100}%` }}
                          />
                        </div>
                        <p className="mt-3 text-xs text-[var(--text-muted)]">
                          You can switch browser tabs and come back later. If the draft finishes saving, this page will pick it up automatically when you return.
                          Do not close or hard refresh the tab until it completes.
                        </p>
                      </div>
                    )}
                    <div className="mt-5 flex justify-center">
                      <Button onClick={generateDraft} loading={generating} disabled={draftPlan?.generationState === 'running'}>
                        {editableQuestions.length ? 'Answer & Generate Draft' : 'Generate Draft'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 1. Summary + KPI row */}
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
                      <div className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
                        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Summary</p>
                        <p className="text-sm leading-6 text-[var(--text-secondary)]">{draftPlan.summary}</p>
                      </div>
                      <div className="flex gap-3 lg:flex-col">
                        <div className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:flex-none">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">North Star</p>
                          <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">{draftPlan.northStarMetric}</p>
                        </div>
                        {draftPlan.successMetric && (
                          <div className="flex-1 rounded-2xl border border-[#DA7756]/20 bg-[#DA7756]/5 px-4 py-3 lg:flex-none">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Target</p>
                            <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">{draftPlan.successMetric.label}</p>
                            <p className="mt-0.5 text-xs text-[#DA7756]">{draftPlan.successMetric.target}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Channel Plan */}
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <ChannelBoard plan={draftPlan} />
                    </div>

                    {/* 3. Priorities — 3-column grid, compact cards */}
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      {(draftPlan.priorities || []).map((priority, index) => (
                        <PriorityCard key={priority.title} priority={priority} index={index} />
                      ))}
                    </div>

                    {/* 4. Content Ideas + Risks side by side */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Content Ideas</p>
                        <ul className="space-y-1.5">
                          {(draftPlan.contentIdeas || []).map(idea => (
                            <li key={idea} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#DA7756]/50" />
                              {idea}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Risks</p>
                        <ul className="space-y-1.5">
                          {(draftPlan.risks || []).map(risk => (
                            <li key={risk} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400/50" />
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* 5. Controls — at the bottom */}
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
                      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Adjust & Commit</p>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_2fr]">
                        <div>
                          <label className="mb-1.5 block text-xs text-[var(--text-muted)]">KPI label</label>
                          <input
                            value={draftMetricLabel}
                            onChange={e => setDraftMetricLabel(e.target.value)}
                            placeholder={draftPlan.successMetric?.label || 'e.g. Qualified sign-ups'}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-[var(--text-muted)]">30-day target</label>
                          <input
                            value={draftMetricTarget}
                            onChange={e => setDraftMetricTarget(e.target.value)}
                            placeholder={draftPlan.successMetric?.target || 'e.g. 50 trials'}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Strategic adjustments</label>
                          <textarea
                            value={draftAdjustments}
                            onChange={e => setDraftAdjustments(e.target.value)}
                            rows={2}
                            placeholder="e.g. Deprioritise Reddit, push Instagram harder, add a webinar launch"
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none"
                          />
                        </div>
                      </div>
                      {draftPlan.diagnosis && (
                        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Bottleneck</p>
                            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{draftPlan.diagnosis.bottleneck}</p>
                          </div>
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Execution constraints</p>
                            <ul className="mt-1.5 space-y-1.5">
                              {(draftPlan.diagnosis.executionConstraints || []).map(item => (
                                <li key={item} className="text-xs text-[var(--text-secondary)]">{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={saveDraft} loading={savingDraft}>Save Draft</Button>
                        <Button variant="secondary" onClick={generateDraft} loading={generating}>Apply & Regenerate</Button>
                        <Button onClick={commitDraft} loading={committing}>Commit Strategy</Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Generate button when no draft — also show controls pre-generation */}
                {!draftPlan && editableQuestions.length === 0 && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
                    <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Optional: guide the plan before generating</p>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_2fr]">
                      <div>
                        <label className="mb-1.5 block text-xs text-[var(--text-muted)]">KPI label</label>
                        <input value={draftMetricLabel} onChange={e => setDraftMetricLabel(e.target.value)} placeholder="e.g. Demo bookings" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[var(--text-muted)]">30-day target</label>
                        <input value={draftMetricTarget} onChange={e => setDraftMetricTarget(e.target.value)} placeholder="e.g. 20 demos booked" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Strategic adjustments</label>
                        <textarea value={draftAdjustments} onChange={e => setDraftAdjustments(e.target.value)} rows={2} placeholder="Anything Marvyn should factor in" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ACTIVE VIEW ── */}
            {view === 'active' && (
              !activePlan ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
                  No active cycle. Commit a draft to begin.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-5">
                    {/* Stats + summary row */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="col-span-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:col-span-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Summary</p>
                        <p className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{activePlan.summary}</p>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Cycle</p>
                        <p className="mt-1.5 text-xs font-semibold text-[var(--text-primary)]">
                          {activePlan.startDate ? new Date(activePlan.startDate).toLocaleDateString() : '—'} – {activePlan.endDate ? new Date(activePlan.endDate).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">North Star</p>
                        <p className="mt-1.5 text-xs font-semibold text-[var(--text-primary)]">{activePlan.northStarMetric}</p>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Tasks done</p>
                        <p className="mt-1.5 text-xl font-bold text-[var(--text-primary)]">{activeCompletion}%</p>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Live signal</p>
                        <p className="mt-1.5 text-xs font-semibold text-[var(--text-primary)]">{activeSignal}</p>
                      </div>
                    </div>

                    {/* Pulse panel */}
                    {latestPulse && !pulseDismissed && (
                      <div className="rounded-2xl border border-[#DA7756]/30 bg-[#DA7756]/5 p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-[#DA7756]">Cycle Pulse — Day {latestPulse.day} of 30</p>
                            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{latestPulse.todaysFocus}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPulseDismissed(true)}
                            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] shrink-0 transition"
                          >
                            Dismiss
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {latestPulse.onTrack.length > 0 && (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-600 mb-2">On track</p>
                              <ul className="space-y-1.5">
                                {latestPulse.onTrack.map(item => (
                                  <li key={item} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                                    <span className="text-emerald-500 shrink-0">✓</span>{item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {latestPulse.behind.length > 0 && (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-amber-600 mb-2">Behind</p>
                              <ul className="space-y-1.5">
                                {latestPulse.behind.map(item => (
                                  <li key={item} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                                    <span className="text-amber-500 shrink-0">→</span>{item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {latestPulse.blocked.length > 0 && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-red-600 mb-2">Blocked ({latestPulse.blocked.length})</p>
                              <ul className="space-y-1.5">
                                {latestPulse.blocked.map(item => (
                                  <li key={item} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                                    <span className="text-red-500 shrink-0">⚠</span>{item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {latestPulse.signalDrift && (
                          <p className="mt-3 text-xs text-[var(--text-secondary)] border-t border-[#DA7756]/15 pt-3">
                            <span className="font-medium text-[var(--text-primary)]">Signal drift: </span>
                            {latestPulse.signalDrift}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Channel plan */}
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <ChannelBoard plan={activePlan} />
                    </div>

                    {/* Execution checklist */}
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Execution Checklist</p>
                          {blockedTaskCount > 0 && (
                            <p className="mt-1 text-xs text-amber-600">
                              ⚠ {blockedTaskCount} task{blockedTaskCount > 1 ? 's' : ''} blocked by incomplete upstream work
                            </p>
                          )}
                        </div>
                        <Button variant="secondary" onClick={closeCycle} loading={closing}>Close Cycle</Button>
                      </div>
                      <div className="space-y-4">
                        {(activePlan.priorities || []).map(priority => {
                          const groupTasks = activePlan.tasks.filter(task => task.sourcePriority === priority.title)
                          const priorityIsBlocked = groupTasks.some(t => isTaskBlocked(t))
                          return (
                            <div key={priority.title}>
                              <div className="mb-2 flex items-center gap-2">
                                <p className="text-xs font-semibold text-[var(--text-primary)]">{priority.title}</p>
                                {priorityIsBlocked && (
                                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                                    blocked
                                  </span>
                                )}
                              </div>
                              <div className="space-y-0.5">
                                {groupTasks.map(task => {
                                  const globalIndex = activePlan.tasks.findIndex(t => t.title === task.title && t.sourcePriority === task.sourcePriority)
                                  const blocked = isTaskBlocked(task)
                                  return (
                                    <div key={`${task.sourcePriority}-${task.title}`}>
                                      <label className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${blocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[var(--surface-2)]'}`}>
                                        <input
                                          type="checkbox"
                                          checked={task.done}
                                          onChange={() => !blocked && toggleTask(globalIndex)}
                                          disabled={blocked}
                                          className="accent-[#DA7756]"
                                        />
                                        <span className={`text-xs break-words ${task.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>
                                          {task.title}
                                        </span>
                                      </label>
                                      {blocked && task.blockedByPriority?.length && (
                                        <p className="ml-10 text-[10px] text-amber-600 pb-1">
                                          Waiting on: {task.blockedByPriority.join(', ')}
                                        </p>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right panel */}
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">KPI Review</p>
                      <div className="space-y-3">
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Target</p>
                          <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">{activePlan.successMetric?.label || activePlan.northStarMetric}</p>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{activePlan.successMetric?.target || 'No explicit target stored.'}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Measured Actual</p>
                          <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">{activeSignal}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Assets</p>
                            <p className="mt-1.5 text-xl font-bold text-[var(--text-primary)]">{blogCount + socialCount}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{blogCount} blog · {socialCount} social</p>
                          </div>
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Clicks</p>
                            <p className="mt-1.5 text-xl font-bold text-[var(--text-primary)]">{fmtCompact(keywords.reduce((s, k) => s + (k.clicks || 0), 0))}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">organic</p>
                          </div>
                        </div>
                        {activePlan.baselineSnapshot && activeCurrentSnapshot && (
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">What changed since commit</p>
                            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Marvyn compares the committed baseline with today&apos;s live data so the next cycle is based on outcomes, not just fresh prompts.</p>
                            <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
                                <p className="text-[10px] text-[var(--text-muted)]">Conversions</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{signedDelta(activeCurrentSnapshot.ga4Conversions, activePlan.baselineSnapshot.ga4Conversions)}</p>
                              </div>
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
                                <p className="text-[10px] text-[var(--text-muted)]">Sessions</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{signedDelta(activeCurrentSnapshot.ga4Sessions, activePlan.baselineSnapshot.ga4Sessions)}</p>
                              </div>
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
                                <p className="text-[10px] text-[var(--text-muted)]">Organic clicks</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{signedDelta(activeCurrentSnapshot.organicClicks, activePlan.baselineSnapshot.organicClicks)}</p>
                              </div>
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
                                <p className="text-[10px] text-[var(--text-muted)]">Assets shipped</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                                  {signedDelta(
                                    (activeCurrentSnapshot.blogCount || 0) + (activeCurrentSnapshot.socialCount || 0),
                                    (activePlan.baselineSnapshot.blogCount || 0) + (activePlan.baselineSnapshot.socialCount || 0)
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Cycle Notes</p>
                        <button
                          type="button"
                          onClick={generateSummary}
                          disabled={preparingSummary}
                          className="flex items-center gap-1.5 text-[11px] text-[#DA7756] hover:text-[#c46140] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {preparingSummary ? (
                            <>
                              <span className="inline-block h-3 w-3 rounded-full border border-[#DA7756]/30 border-t-[#DA7756] animate-spin" />
                              Generating…
                            </>
                          ) : (
                            'Generate summary ↗'
                          )}
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 block text-xs text-[var(--text-muted)]">KPI label</label>
                            <input value={activeMetricLabel} onChange={e => setActiveMetricLabel(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Target</label>
                            <input value={activeMetricTarget} onChange={e => setActiveMetricTarget(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Wins / outcomes</label>
                          <textarea value={activeWins} onChange={e => setActiveWins(e.target.value)} rows={3} placeholder="What actually shipped or improved this cycle" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Blockers / notes</label>
                          <textarea value={activeNotes} onChange={e => setActiveNotes(e.target.value)} rows={3} placeholder="What failed or got blocked, and why" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Adjustments for next cycle</label>
                          <textarea value={activeAdjustments} onChange={e => setActiveAdjustments(e.target.value)} rows={2} placeholder="One structural fix to apply before the next cycle starts" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={saveActive} loading={savingCycle}>Save</Button>
                          <Button onClick={closeCycle} loading={closing}>Close Cycle</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ── HISTORY VIEW ── */}
            {view === 'history' && (
              <div className="space-y-4">
                {historySorted.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
                    No completed cycles yet. Close your first active cycle to start building history.
                  </div>
                ) : (
                  historySorted.map(plan => (
                    <div key={plan._id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Completed cycle</p>
                          <h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                            {plan.startDate ? new Date(plan.startDate).toLocaleDateString() : '—'} – {plan.endDate ? new Date(plan.endDate).toLocaleDateString() : '—'}
                          </h3>
                        </div>
                        <div className="flex gap-3">
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-right">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Target</p>
                            <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{plan.successMetric?.target || '—'}</p>
                          </div>
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-right">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Tasks</p>
                            <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">
                              {plan.tasks?.length ? `${Math.round((plan.tasks.filter(t => t.done).length / plan.tasks.length) * 100)}%` : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{plan.summary}</p>
                      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Adjustments</p>
                          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{plan.customAdjustments || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">What worked</p>
                          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{plan.manualWins || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Blockers</p>
                          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{plan.manualNotes || '—'}</p>
                        </div>
                      </div>
                      {plan.review && (
                        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 lg:col-span-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Review Summary</p>
                            <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{plan.review.summary || '—'}</p>
                            <p className="mt-2 text-[10px] text-[var(--text-muted)]">Actual signal: {plan.review.actualSignal || '—'}</p>
                            {plan.review.executionSummary && (
                              <p className="mt-2 text-[10px] text-[var(--text-muted)]">Execution: {plan.review.executionSummary}</p>
                            )}
                          </div>
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 lg:col-span-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">What changed</p>
                            <ul className="mt-1.5 space-y-1">
                              {(plan.review.signalChanges || []).map(item => (
                                <li key={item} className="text-xs text-[var(--text-secondary)]">{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">What worked</p>
                            <ul className="mt-1.5 space-y-1">
                              {(plan.review.whatWorked || []).map(item => (
                                <li key={item} className="text-xs text-[var(--text-secondary)]">{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">What failed</p>
                            <ul className="mt-1.5 space-y-1">
                              {(plan.review.whatFailed || []).map(item => (
                                <li key={item} className="text-xs text-[var(--text-secondary)]">{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 lg:col-span-2">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Next cycle focus</p>
                            <ul className="mt-1.5 space-y-1">
                              {(plan.review.nextCycleFocus || []).map(item => (
                                <li key={item} className="text-xs text-[var(--text-secondary)]">{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

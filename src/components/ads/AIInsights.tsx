'use client'

import { useState } from 'react'
import type { CampaignInsight } from './CampaignPerformance'

type Priority = 'high' | 'medium' | 'low'

interface Recommendation {
  priority: Priority
  platform: 'meta' | 'google' | 'all'
  action: string
}

interface ClarityContext {
  overview?: {
    totalSessions: number
    avgScrollDepth: number
    deadClickRate: number
    rageClickRate: number
  }
  byDevice?: Array<{
    label: string
    sessions: number
    scrollDepth: number
    engagementSecs: number
    deadClickRate: number
  }>
  byBrowser?: Array<{
    label: string
    sessions: number
    scrollDepth: number
    engagementSecs: number
    deadClickRate: number
  }>
  aiInsights?: Array<{
    severity: 'high' | 'medium' | 'low'
    headline: string
    evidence: string
    whyItMatters: string
    fix: string
  }>
}

// ─── Parser ───────────────────────────────────────────────────────────────────
// Looks for INSIGHT_START ... INSIGHT_END blocks in Claude's response.
// Falls back to numbered/bulleted list parsing if blocks aren't present.

function parseStructured(text: string): Recommendation[] {
  const blocks = text.split('INSIGHT_END').filter(b => b.includes('INSIGHT_START'))
  if (blocks.length === 0) return []

  return blocks.flatMap(block => {
    const priority = (block.match(/PRIORITY:\s*(HIGH|MEDIUM|LOW)/i)?.[1] ?? 'medium').toLowerCase() as Priority
    const platformRaw = (block.match(/PLATFORM:\s*(meta|google|all)/i)?.[1] ?? 'all').toLowerCase()
    const platform = (['meta', 'google', 'all'].includes(platformRaw) ? platformRaw : 'all') as 'meta' | 'google' | 'all'
    const action = block.match(/ACTION:\s*([\s\S]+)/)?.[1]?.replace(/INSIGHT_START/g, '').trim() ?? ''
    if (action.length < 10) return []
    return [{ priority, platform, action }]
  })
}

function parseFallback(text: string): Recommendation[] {
  // Split on numbered items (1. 2. etc.) or bold bullets (**text**)
  const chunks = text.split(/\n(?=\d+\.\s|\*\*\d|\*\*[A-Z])/).filter(c => c.trim().length > 15)
  return chunks.slice(0, 5).map((chunk): Recommendation => {
    const lower = chunk.toLowerCase()
    const priority: Priority =
      lower.includes('pause') || lower.includes('stop') || lower.includes('urgent') ? 'high' :
      lower.includes('increase') || lower.includes('scale') || lower.includes('expand') ? 'medium' : 'low'
    const platform: 'meta' | 'google' | 'all' =
      lower.includes('meta') || lower.includes('facebook') ? 'meta' :
      lower.includes('google') ? 'google' : 'all'
    const action = chunk.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim()
    return { priority, platform, action }
  }).filter(r => r.action.length > 10)
}

function parseRecs(text: string): Recommendation[] {
  console.log('[AIInsights] Parsing response, length:', text.length)
  const structured = parseStructured(text)
  if (structured.length > 0) {
    console.log('[AIInsights] Parsed', structured.length, 'structured recs')
    return structured
  }
  const fallback = parseFallback(text)
  console.log('[AIInsights] Fallback parsed', fallback.length, 'recs')
  return fallback
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(
  campaigns: CampaignInsight[],
  spend: number,
  roas: number | null,
  symbol: string,
  clarity?: ClarityContext | null
): string {
  const withSpend = campaigns.filter(c => c.spend > 0)
  const topPerformers = [...withSpend]
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))
    .slice(0, 4)
  const underperformers = [...withSpend]
    .sort((a, b) => (a.roas ?? 999) - (b.roas ?? 999))
    .slice(0, 4)

  const campaignData = {
    summary: {
      totalSpend: `${symbol}${spend.toFixed(2)}`,
      blendedROAS: roas != null ? `${roas.toFixed(2)}x` : 'no conversion tracking set up',
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status !== 'PAUSED').length,
      totalImpressions: campaigns.reduce((s, c) => s + c.impressions, 0),
      totalClicks: campaigns.reduce((s, c) => s + c.clicks, 0),
      totalConversions: campaigns.reduce((s, c) => s + c.conversions, 0),
    },
    topPerformers: topPerformers.map(c => ({
      name: c.name,
      platform: c.platform,
      spend: `${symbol}${c.spend.toFixed(2)}`,
      roas: c.roas != null ? `${c.roas.toFixed(2)}x` : 'N/A',
      ctr: `${c.ctr.toFixed(2)}%`,
      conversions: c.conversions,
      status: c.status,
    })),
    underperformers: underperformers.map(c => ({
      name: c.name,
      platform: c.platform,
      spend: `${symbol}${c.spend.toFixed(2)}`,
      roas: c.roas != null ? `${c.roas.toFixed(2)}x` : 'N/A',
      ctr: `${c.ctr.toFixed(2)}%`,
      conversions: c.conversions,
      status: c.status,
    })),
  }

  const claritySection = clarity?.overview ? `

Landing Page Behavior Context from Microsoft Clarity:
${JSON.stringify({
  overview: clarity.overview,
  topDeviceRows: clarity.byDevice?.slice(0, 3) || [],
  topBrowserRows: clarity.byBrowser?.slice(0, 3) || [],
  uxIssues: clarity.aiInsights?.slice(0, 3) || [],
}, null, 2)}
` : ''

  return `Analyze these Meta Ads campaign results and provide specific actionable recommendations:

Campaign Data:
${JSON.stringify(campaignData, null, 2)}
${claritySection}

Focus on:
1. Budget reallocation between campaigns
2. Audience optimization suggestions
3. Creative fatigue indicators
4. Specific actions to improve ROAS
5. Use landing-page behavior issues from Clarity when relevant. If Clarity shows dead clicks, rage clicks, or poor engagement, mention the UX fix explicitly instead of only changing campaign settings.

Return EXACTLY 4 recommendations in this structured format (do not deviate from it):

INSIGHT_START
PRIORITY: HIGH
PLATFORM: meta
ACTION: [specific action referencing campaign names and actual numbers from the data above]
INSIGHT_END

INSIGHT_START
PRIORITY: MEDIUM
PLATFORM: all
ACTION: [specific action referencing campaign names and actual numbers]
INSIGHT_END

Use PRIORITY: HIGH for pause/stop actions, MEDIUM for budget or targeting changes, LOW for test suggestions.
Use PLATFORM: meta, google, or all.
Reference specific campaign names and numbers — no generic advice.`
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<Priority, string> = {
  high:   'bg-red-900/20 text-red-400 border-red-900/30',
  medium: 'bg-yellow-900/20 text-yellow-400 border-yellow-900/30',
  low:    'bg-blue-900/20 text-blue-400 border-blue-900/30',
}
const PLATFORM_COLOR: Record<string, string> = {
  meta:   'bg-blue-900/30 text-blue-400',
  google: 'bg-green-900/30 text-green-400',
  all:    'bg-[#1A1A1A] text-[#A0A0A0]',
}
const PLATFORM_LABEL: Record<string, string> = { meta: 'Meta', google: 'Google', all: 'All Platforms' }

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  campaigns: CampaignInsight[]
  spend: number
  roas: number | null
  symbol: string
}

export function AIInsights({ campaigns, spend, roas, symbol }: Props) {
  const [loading, setLoading] = useState(false)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function loadInsights() {
    console.log('[AIInsights] Generate clicked — campaigns:', campaigns.length, 'spend:', spend)
    setLoading(true)
    setStreamText('')
    setRecs([])
    setError(null)
    let fullText = ''

    try {
      let clarityContext: ClarityContext | null = null
      try {
        const clarityRes = await fetch('/api/analytics/clarity')
        const clarityData = await clarityRes.json()
        if (clarityRes.ok && clarityData?.connected && !clarityData?.error && clarityData?.overview) {
          clarityContext = clarityData
        }
      } catch {}

      const prompt = buildPrompt(campaigns, spend, roas, symbol, clarityContext)
      console.log('[AIInsights] Sending prompt, length:', prompt.length)

      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, skillId: 'paid-ads' }),
      })

      console.log('[AIInsights] Response status:', res.status)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        console.error('[AIInsights] API error:', res.status, err)
        setError(err.error ?? `Error ${res.status}`)
        return
      }

      if (!res.body) {
        setError('No response stream')
        return
      }

      const reader = res.body.getReader()
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
              fullText += data.content
              setStreamText(fullText)
            } else if (data.type === 'error') {
              console.error('[AIInsights] Stream error event:', data.content)
              setError(data.content ?? 'AI error')
            } else if (data.type === 'done') {
              console.log('[AIInsights] Stream done, total length:', fullText.length)
            }
          } catch (parseErr) {
            // ignore malformed SSE lines
          }
        }
      }

      if (fullText.length > 0) {
        const parsed = parseRecs(fullText)
        if (parsed.length > 0) {
          setRecs(parsed)
        } else {
          // Show raw as single card if parser found nothing structured
          console.warn('[AIInsights] Parser returned 0 recs, showing raw')
          setRecs([{ priority: 'medium', platform: 'all', action: fullText.trim() }])
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[AIInsights] Fetch failed:', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const hasData = campaigns.some(c => c.spend > 0)

  return (
    <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">✦</span>
          <p className="text-xs font-semibold text-[#555] uppercase tracking-wider">AI Insights</p>
          {loading && (
            <span className="flex items-center gap-1.5 text-xs text-[#DA7756]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756] animate-pulse" />
              Analysing…
            </span>
          )}
        </div>
        <button
          onClick={loadInsights}
          disabled={loading || !hasData}
          className="px-3 py-1.5 text-xs bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] rounded-lg text-[#A0A0A0] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Thinking…' : recs.length > 0 ? 'Refresh' : 'Generate Insights'}
        </button>
      </div>

      {/* Empty / no data */}
      {!loading && recs.length === 0 && !streamText && !error && (
        <div className="text-center py-8">
          {hasData ? (
            <>
              <p className="text-[#555] text-sm">Click &quot;Generate Insights&quot; to get AI-powered recommendations</p>
              <p className="text-[#333] text-xs mt-1">Analyses spend, ROAS, CTR and campaign data</p>
            </>
          ) : (
            <>
              <p className="text-[#555] text-sm">No campaign spend data available</p>
              <p className="text-[#333] text-xs mt-1">Run campaigns first to generate insights</p>
            </>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-900/10 border border-red-900/30 rounded-lg px-4 py-3">
          <p className="text-xs text-red-400 font-medium mb-1">Failed to generate insights</p>
          <p className="text-xs text-red-400/70">{error}</p>
          <button onClick={loadInsights} className="mt-2 text-xs text-[#DA7756] hover:underline">
            Try again →
          </button>
        </div>
      )}

      {/* Skeleton while loading */}
      {loading && recs.length === 0 && !streamText && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 border border-[#1E1E1E] rounded-lg space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-14 bg-[#1A1A1A] rounded-full" />
                <div className="h-4 w-14 bg-[#1A1A1A] rounded-full" />
              </div>
              <div className="h-3.5 w-full bg-[#1A1A1A] rounded" />
              <div className="h-3.5 w-4/5 bg-[#1A1A1A] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Live stream preview while loading */}
      {loading && streamText && recs.length === 0 && (
        <div className="p-4 border border-[#1E1E1E] rounded-lg bg-[#0D0D0D]">
          <pre className="text-xs text-[#A0A0A0] whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
            {streamText}
            <span className="inline-block w-1 h-3.5 bg-[#DA7756] animate-pulse ml-0.5 align-middle" />
          </pre>
        </div>
      )}

      {/* Parsed recommendation cards */}
      {recs.length > 0 && (
        <div className="space-y-2">
          {recs.map((rec, i) => (
            <div key={i} className="p-4 border border-[#1E1E1E] rounded-lg hover:border-[#2A2A2A] transition-colors">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wide ${PRIORITY_STYLES[rec.priority]}`}>
                  {rec.priority}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PLATFORM_COLOR[rec.platform]}`}>
                  {PLATFORM_LABEL[rec.platform]}
                </span>
              </div>
              <p className="text-sm text-[#C0C0C0] leading-relaxed">{rec.action}</p>
              <div className="mt-2.5 flex justify-end">
                <button className="text-[10px] text-[#DA7756] hover:text-[#DA7756]/80 transition-colors">
                  Apply →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

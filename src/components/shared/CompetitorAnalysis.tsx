'use client'

import { useState } from 'react'
import { Button } from './Button'

const LOCATIONS = [
  'India', 'United States', 'United Kingdom', 'Australia', 'Canada',
  'Singapore', 'United Arab Emirates', 'Germany', 'France',
]

const STEP_LABELS = [
  { icon: '🔍', label: 'Crawling your website' },
  { icon: '🌐', label: 'Finding competitors on Google' },
  { icon: '📊', label: 'Analyzing competitor data' },
  { icon: '🤖', label: 'Generating AI insights' },
]

const TYPE_COLORS: Record<string, string> = {
  keyword_gap: 'bg-blue-900/30 text-blue-300 border-blue-800/40',
  content_gap: 'bg-purple-900/30 text-purple-300 border-purple-800/40',
  positioning: 'bg-orange-900/30 text-orange-300 border-orange-800/40',
}

interface CompetitorItem {
  domain: string
  title: string
  description: string
  organicTraffic?: number
  organicKeywords?: number
  domainRank?: number
  mainStrength?: string
  weakness?: string
  url?: string
}

interface Opportunity {
  type: string
  description: string
  action: string
}

export interface AnalysisInsights {
  summary: string
  competitors: CompetitorItem[]
  opportunities: Opportunity[]
  overallScore: number
}

interface Props {
  defaultDomain?: string
  onComplete?: (insights: AnalysisInsights) => void
  compact?: boolean
}

export default function CompetitorAnalysis({ defaultDomain = '', onComplete, compact = false }: Props) {
  const [domain, setDomain] = useState(defaultDomain)
  const [location, setLocation] = useState('India')
  const [running, setRunning] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [currentStep, setCurrentStep] = useState(-1)
  const [insights, setInsights] = useState<AnalysisInsights | null>(null)
  const [error, setError] = useState('')

  const runAnalysis = async () => {
    const target = domain.trim()
    if (!target) return
    setRunning(true)
    setCompletedSteps([])
    setCurrentStep(-1)
    setInsights(null)
    setError('')

    try {
      const res = await fetch('/api/analysis/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: target, location }),
      })

      if (!res.body) throw new Error('No response stream')
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

            if (msg.type === 'progress') {
              setCurrentStep(msg.step)
              setCompletedSteps(prev => {
                const next = [...prev]
                if (msg.step > 1 && !next.includes(msg.step - 1)) next.push(msg.step - 1)
                return next
              })
            }

            if (msg.type === 'complete') {
              setCompletedSteps([1, 2, 3, 4])
              setCurrentStep(-1)
              setInsights(msg.insights)
              onComplete?.(msg.insights)
            }

            if (msg.type === 'error') {
              setError(msg.message)
            }
          } catch {}
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Input row */}
      {!insights && (
        <div className={`space-y-3 ${compact ? '' : 'bg-[#111] border border-[#1E1E1E] rounded-xl p-4'}`}>
          {!compact && <h3 className="text-sm font-semibold text-white">Competitor Analysis</h3>}
          <div className="flex gap-2">
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="yoursite.com"
              disabled={running}
              className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] outline-none focus:border-[#DA7756]/50 disabled:opacity-50"
            />
            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              disabled={running}
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
            >
              {LOCATIONS.map(l => <option key={l} className="bg-[#111]">{l}</option>)}
            </select>
            <Button size="sm" onClick={runAnalysis} loading={running} disabled={!domain.trim()}>
              Analyze
            </Button>
          </div>
        </div>
      )}

      {/* Progress steps */}
      {running && (
        <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5 space-y-3">
          <p className="text-xs text-[#555] mb-3">This takes ~30–60 seconds…</p>
          {STEP_LABELS.map((s, idx) => {
            const stepNum = idx + 1
            const done = completedSteps.includes(stepNum)
            const active = currentStep === stepNum
            return (
              <div key={idx} className={`flex items-center gap-3 transition-opacity ${active || done ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors ${
                  done ? 'bg-green-500/20 text-green-400' :
                  active ? 'bg-[#DA7756]/20 text-[#DA7756]' :
                  'bg-[#1A1A1A] text-[#555]'
                }`}>
                  {done ? '✓' : active ? <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756] animate-pulse block" /> : stepNum}
                </div>
                <span className={`text-sm ${done ? 'text-green-400' : active ? 'text-white' : 'text-[#555]'}`}>
                  {s.icon} {s.label}
                  {done ? '' : active ? '…' : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Error */}
      {error && !running && (
        <div className="bg-red-900/20 border border-red-900/40 rounded-xl p-4 text-sm text-red-300">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-xs underline opacity-70">dismiss</button>
        </div>
      )}

      {/* Results */}
      {insights && (
        <div className="space-y-4">
          {/* Reset button */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#555]">Analyzed: {domain} · {location}</p>
            <button
              onClick={() => { setInsights(null); setCompletedSteps([]); setError('') }}
              className="text-xs text-[#555] hover:text-white transition-colors"
            >
              Re-analyze
            </button>
          </div>

          {/* Summary */}
          <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-xs font-medium text-white">Competitive Landscape</div>
              <div className={`ml-auto text-sm font-bold px-2 py-0.5 rounded ${
                insights.overallScore >= 70 ? 'bg-red-900/30 text-red-300' :
                insights.overallScore >= 40 ? 'bg-yellow-900/30 text-yellow-300' :
                'bg-green-900/30 text-green-300'
              }`}>
                Competition: {insights.overallScore}/100
              </div>
            </div>
            <p className="text-sm text-[#A0A0A0] leading-relaxed">{insights.summary}</p>
          </div>

          {/* Competitor cards */}
          <div className="grid grid-cols-1 gap-3">
            {insights.competitors?.map((c, i) => (
              <div key={i} className="bg-[#111] border border-[#1E1E1E] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{c.domain}</span>
                      {c.domainRank != null && c.domainRank > 0 && (
                        <span className="text-[10px] bg-[#2A2A2A] px-1.5 py-0.5 rounded text-[#A0A0A0]">
                          DR {c.domainRank}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#A0A0A0] mt-0.5 truncate">{c.title}</p>
                  </div>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-[#DA7756] hover:underline shrink-0">
                      View site ↗
                    </a>
                  )}
                </div>

                {c.description && (
                  <p className="text-xs text-[#555] mb-3 line-clamp-2">{c.description}</p>
                )}

                {(c.organicTraffic || c.organicKeywords) && (
                  <div className="flex gap-4 mb-3 text-xs text-[#555]">
                    {c.organicTraffic != null && c.organicTraffic > 0 && (
                      <span>~{c.organicTraffic.toLocaleString()} organic visits/mo</span>
                    )}
                    {c.organicKeywords != null && c.organicKeywords > 0 && (
                      <span>{c.organicKeywords.toLocaleString()} keywords</span>
                    )}
                  </div>
                )}

                {(c.mainStrength || c.weakness) && (
                  <div className="flex flex-wrap gap-2">
                    {c.mainStrength && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-green-900/20 text-green-400 border border-green-900/30">
                        ✓ {c.mainStrength}
                      </span>
                    )}
                    {c.weakness && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-red-900/20 text-red-400 border border-red-900/30">
                        ✗ {c.weakness}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Opportunities */}
          {insights.opportunities?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-white px-1">Opportunities</p>
              {insights.opportunities.map((o, i) => (
                <div key={i} className="bg-[#111] border border-[#1E1E1E] rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border shrink-0 mt-0.5 ${
                      TYPE_COLORS[o.type] ?? 'bg-[#2A2A2A] text-[#A0A0A0] border-[#3A3A3A]'
                    }`}>
                      {o.type.replace('_', ' ')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#C0C0C0]">{o.description}</p>
                      <p className="text-xs text-[#DA7756] mt-1">{o.action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

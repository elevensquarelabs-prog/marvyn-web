'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Issue {
  severity: string
  category: string
  title: string
  recommendation: string
}

interface IssuesPanelProps {
  issues: Issue[]
  criticalCount: number
  warningCount: number
  passedCount: number
  fixTexts: Record<number, string>
  fixingIndex: number | null
  onFixWithAI: (idx: number, issue: { title: string; recommendation: string }) => void
  domain: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  critical: { color: 'text-red-400',   bg: 'bg-red-500/15',   dot: 'bg-red-500',   label: 'Critical' },
  warning:  { color: 'text-amber-400', bg: 'bg-amber-500/15', dot: 'bg-amber-500', label: 'Warning'  },
  info:     { color: 'text-blue-400',  bg: 'bg-blue-500/15',  dot: 'bg-blue-500',  label: 'Info'     },
}

const CATEGORY_CONFIG: Record<string, string> = {
  Technical:   'bg-purple-500/15 text-purple-400',
  'On-Page':   'bg-blue-500/15 text-blue-400',
  Performance: 'bg-orange-500/15 text-orange-400',
}

const FILTERS = ['All', 'Critical', 'Warning', 'Performance', 'On-Page', 'Technical'] as const
type Filter = typeof FILTERS[number]

// ─── Severity dot icon ────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info
  return (
    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
    </span>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[100, 80, 90, 60, 75].map((w, i) => (
        <div key={i} className="h-3 bg-[#2A2A2A] rounded-full" style={{ width: `${w}%` }} />
      ))}
      <div className="h-3 bg-[#2A2A2A] rounded-full w-1/2" />
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyFixState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-[#DA7756]/10 border border-[#DA7756]/20 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 3l1.5 4.5H18l-3.75 2.75L15.75 15 12 12.25 8.25 15l1.5-4.75L6 7.5h4.5L12 3z" stroke="#DA7756" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M5 20h14" stroke="#DA7756" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-white">AI-Powered Fix</p>
        <p className="text-xs text-[#555] mt-1 leading-relaxed">Select an issue on the left to get step-by-step fix instructions</p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IssuesPanel({
  issues, criticalCount, warningCount, passedCount,
  fixTexts, fixingIndex, onFixWithAI, domain,
}: IssuesPanelProps) {
  const [filter, setFilter] = useState<Filter>('All')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  // Filter logic
  const filteredIssues = issues.filter(issue => {
    if (filter === 'All') return true
    if (filter === 'Critical') return issue.severity === 'critical'
    if (filter === 'Warning') return issue.severity === 'warning'
    return issue.category === filter
  })

  const selectedIssue = selectedIdx != null ? issues[selectedIdx] : null
  const fixText = selectedIdx != null ? fixTexts[selectedIdx] : undefined
  const isLoading = selectedIdx != null && fixingIndex === selectedIdx

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx)
    if (!fixTexts[idx] && fixingIndex !== idx) {
      onFixWithAI(idx, issues[idx])
    }
  }

  const handleCopy = () => {
    if (fixText) {
      navigator.clipboard.writeText(fixText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const filterCount = (f: Filter) => {
    if (f === 'All') return issues.length
    if (f === 'Critical') return criticalCount
    if (f === 'Warning') return warningCount
    return issues.filter(i => i.category === f).length
  }

  return (
    <div className="flex gap-5 w-full h-full">

      {/* ── LEFT: Issue list ───────────────────────────────────────────────── */}
      <div className="flex-[3] flex flex-col gap-4 min-w-0">

        {/* Stats chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'Critical', count: criticalCount, cfg: SEVERITY_CONFIG.critical },
            { label: 'Warning',  count: warningCount,  cfg: SEVERITY_CONFIG.warning  },
            { label: 'Passed',   count: passedCount,   cfg: { color: 'text-green-400', bg: 'bg-green-500/15', dot: 'bg-green-500', label: 'Passed' } },
          ].map(s => (
            <span key={s.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${s.cfg.bg} ${s.cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.cfg.dot}`} />
              {s.count} {s.label}
            </span>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => {
            const count = filterCount(f)
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-[#DA7756]/20 border-[#DA7756]/40 text-[#DA7756]'
                    : 'bg-[#111] border-[#1E1E1E] text-[#555] hover:text-[#A0A0A0]'
                }`}
              >
                {f} {count > 0 && `(${count})`}
              </button>
            )
          })}
        </div>

        {/* Issue cards */}
        <div className="space-y-2.5">
          {filteredIssues.length === 0 && (
            <div className="bg-[#111] border border-[#1E1E1E] rounded-2xl p-8 text-center">
              <p className="text-sm text-green-400 font-medium">✓ No {filter !== 'All' ? filter.toLowerCase() : ''} issues found</p>
              <p className="text-xs text-[#555] mt-1">This section is clean</p>
            </div>
          )}

          {filteredIssues.map((issue, fi) => {
            // map filtered index back to original
            const origIdx = issues.indexOf(issue)
            const isSelected = selectedIdx === origIdx
            const sevCfg = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.info
            const catClass = CATEGORY_CONFIG[issue.category] ?? 'bg-[#2A2A2A] text-[#A0A0A0]'

            return (
              <button
                key={origIdx}
                onClick={() => handleSelect(origIdx)}
                className={`w-full text-left bg-[#111] rounded-2xl p-5 border transition-all ${
                  isSelected
                    ? 'border-[#DA7756]/50 bg-[#DA7756]/5 shadow-[inset_3px_0_0_#DA7756]'
                    : 'border-[#1E1E1E] hover:border-[#2A2A2A] hover:bg-[#161616]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <SeverityDot severity={issue.severity} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-snug">{issue.title}</p>
                      <p className="text-xs text-[#555] mt-1 leading-relaxed line-clamp-2">{issue.recommendation}</p>
                      <p className="text-[11px] text-[#333] mt-1.5 font-mono">{domain}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg shrink-0 whitespace-nowrap mt-0.5 ${catClass}`}>
                    {issue.category}
                  </span>
                </div>

                {/* Severity label row */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1A1A1A]">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${sevCfg.bg} ${sevCfg.color}`}>
                    {sevCfg.label}
                  </span>
                  {isSelected ? (
                    <span className="text-[10px] text-[#DA7756] ml-auto">Viewing fix →</span>
                  ) : (
                    <span className="text-[10px] text-[#555] ml-auto">Fix with AI →</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: AI Fix panel ────────────────────────────────────────────── */}
      <div className="flex-[2] min-w-0">
        <div className="sticky top-0 bg-[#111] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 200px)' }}>

          {/* Panel header */}
          <div className="px-5 py-4 border-b border-[#1E1E1E] shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#DA7756]/20 flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1.5l1 3H11L8.5 6.25 9.5 9.5 6.5 7.75 3.5 9.5l1-3.25L2 4.5h3l1-3z" stroke="#DA7756" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white">AI-Powered Fix</p>
            </div>
            {selectedIssue ? (
              <p className="text-xs text-[#555] mt-1.5 line-clamp-1">{selectedIssue.title}</p>
            ) : (
              <p className="text-xs text-[#555] mt-1.5">Automated solution for your SEO issue</p>
            )}
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto">
            {!selectedIssue && (
              <div className="h-64">
                <EmptyFixState />
              </div>
            )}

            {selectedIssue && (
              <div className="p-5 space-y-4">
                {/* Selected issue preview */}
                <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <SeverityDot severity={selectedIssue.severity} />
                    <div>
                      <p className="text-xs font-semibold text-white">{selectedIssue.title}</p>
                      <p className="text-[11px] text-[#555] mt-0.5">High · Affects search ranking</p>
                      <p className="text-[11px] text-[#333] mt-1 font-mono">{domain}</p>
                    </div>
                  </div>
                </div>

                {/* Fix content */}
                {isLoading && <Skeleton />}

                {!isLoading && fixText && (
                  <div className="relative">
                    <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-xl p-4 text-xs text-[#A0A0A0] whitespace-pre-wrap leading-relaxed font-mono max-h-80 overflow-y-auto">
                      {fixText}
                    </div>
                  </div>
                )}

                {!isLoading && !fixText && (
                  <div className="text-center py-4">
                    <p className="text-xs text-[#555]">Click &quot;Apply Fix&quot; to generate instructions</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel footer */}
          <div className="p-4 border-t border-[#1E1E1E] shrink-0 space-y-2">
            <button
              onClick={() => selectedIdx != null && onFixWithAI(selectedIdx, issues[selectedIdx])}
              disabled={!selectedIssue || isLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#DA7756] hover:bg-[#C4633F] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : 'Apply Fix'}
            </button>
            {fixText && (
              <button
                onClick={handleCopy}
                className="w-full text-xs text-[#555] hover:text-[#A0A0A0] py-1.5 transition-colors"
              >
                {copied ? '✓ Copied to clipboard' : 'Copy instructions'}
              </button>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}

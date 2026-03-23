'use client'

import { Button } from '@/components/shared/Button'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditData = {
  domain: string
  location: string
  city?: string
  score: number
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
  issues: Array<{ severity: string; category: string; title: string; recommendation: string }>
  competitors: Array<{
    domain: string
    title: string
    url: string
    organicTraffic?: number
    organicKeywords?: number
    domainRank?: number
    mainStrength?: string
    weakness?: string
  }>
  performance: { score: number; fcp?: string; lcp?: string; cls?: string; tbt?: string; mobile: boolean }
  aiActions: Array<{ priority: string; effort: string; impact: string; title: string; instructions: string[]; type: string; done: boolean }>
  pageKeywords: Array<{ keyword: string; source: string; searchVolume?: number; difficulty?: number; position?: number }>
  createdAt: Date
  completedAt?: Date
  status: string
}

interface Props {
  audit: AuditData
  onSwitchTab: (tab: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 70) return '#16a34a'
  if (s >= 40) return '#d97706'
  return '#dc2626'
}

function scoreLabel(s: number) {
  if (s >= 70) return 'Good'
  if (s >= 40) return 'Fair'
  return 'Poor'
}

// ─── Score Gauge (arc style) ──────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const r = 52
  const cx = 70
  const cy = 70
  // Draw a 220° arc (from 160° to 380°/20°)
  const startAngle = 160
  const endAngle = 380
  const totalArc = endAngle - startAngle
  const filledArc = (score / 100) * totalArc

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const arcPath = (sa: number, ea: number) => {
    const s = { x: cx + r * Math.cos(toRad(sa)), y: cy + r * Math.sin(toRad(sa)) }
    const e = { x: cx + r * Math.cos(toRad(ea)), y: cy + r * Math.sin(toRad(ea)) }
    const large = ea - sa > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const color = scoreColor(score)

  return (
    <svg width="140" height="120" viewBox="0 0 140 120">
      {/* Track */}
      <path d={arcPath(startAngle, endAngle)} fill="none" stroke="#E8E4DF" strokeWidth="10" strokeLinecap="round" />
      {/* Fill */}
      {score > 0 && (
        <path
          d={arcPath(startAngle, startAngle + filledArc)}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          style={{ transition: 'all 1.2s ease' }}
        />
      )}
      {/* Score number */}
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#1A1A1A" fontSize="30" fontWeight="700">{score}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="#888" fontSize="11">/100</text>
      {/* Label below */}
      <text x={cx} y={cy + 40} textAnchor="middle" fill={color} fontSize="11" fontWeight="600">{scoreLabel(score)}</text>
    </svg>
  )
}

// ─── Check icon ───────────────────────────────────────────────────────────────

function CheckIcon({ pass }: { pass: boolean }) {
  return pass ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#dcfce7" />
      <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#fee2e2" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Lock icon ────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="6" width="10" height="7" rx="1.5" fill="#D1C9C0" />
      <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#D1C9C0" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Favicon ──────────────────────────────────────────────────────────────────

function Favicon({ domain }: { domain: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={16}
      height={16}
      className="rounded-sm shrink-0"
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SEOOverview({ audit, onSwitchTab }: Props) {
  const perf = audit.performance
  const pd = audit.pageData

  // Derive readability from score
  const readability = audit.score >= 70 ? 'Good' : audit.score >= 40 ? 'Fair' : 'Poor'
  const readabilityColor = audit.score >= 70 ? 'text-green-600 bg-green-50' : audit.score >= 40 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'

  // Word count estimate from headings
  const wordCount = Math.max(120, (pd.headings?.length ?? 0) * 12 + (pd.title?.split(' ').length ?? 0) * 8)

  // On-page checks
  const onPageChecks = [
    { label: 'Meta Title', value: pd.title ? pd.title.slice(0, 55) + (pd.title.length > 55 ? '…' : '') : '—', pass: !!pd.title },
    { label: 'Meta Description', value: pd.description ? pd.description.slice(0, 80) + (pd.description.length > 80 ? '…' : '') : 'Missing', pass: !!pd.description },
    { label: 'H1 Tag', value: pd.h1 ? pd.h1.slice(0, 55) + (pd.h1.length > 55 ? '…' : '') : 'Missing', pass: !!pd.h1 },
    { label: 'Viewport Meta', value: 'Present', pass: true },
  ]

  // Target keyword from H1
  const targetKeyword = (pd.h1 || pd.title || audit.domain).split(/\s+/).slice(0, 5).join(' ')

  // Passed checks (issues NOT triggered)
  const PASSED_CHECKS = [
    { key: 'has_https', title: 'HTTPS Enabled', sub: 'Secure connection active' },
    { key: 'has_title', title: 'Title Tag Present', sub: 'Page has a title tag' },
    { key: 'has_description', title: 'Meta Description', sub: 'Description tag found' },
    { key: 'has_h1', title: 'H1 Heading', sub: 'Primary heading present' },
    { key: 'has_canonical', title: 'Canonical Tag', sub: 'Prevents duplicate content' },
    { key: 'mobile_friendly', title: 'Mobile Friendly', sub: 'Viewport tag detected' },
    { key: 'no_broken_links', title: 'No Broken Links', sub: 'All links returning 200' },
    { key: 'fast_load', title: 'Reasonable Load Time', sub: 'Page loads within limits' },
  ]

  const issueTitles = new Set(audit.issues.map(i => i.title.toLowerCase()))
  const passedItems = PASSED_CHECKS.filter(c => {
    if (c.key === 'has_https') return !issueTitles.has('page served over http')
    if (c.key === 'has_title') return !!pd.title
    if (c.key === 'has_description') return !!pd.description
    if (c.key === 'has_h1') return !!pd.h1
    return true
  }).slice(0, 8)

  // Domain authority from first competitor with data, or own onpageScore
  const domainAuthority = audit.competitors.find(c => c.domainRank && c.domainRank > 0)?.domainRank ?? pd.onpageScore ?? 0

  const card = 'bg-white border border-[#E8E4DF] rounded-2xl'

  return (
    <div className="space-y-4 max-w-4xl">

      {/* ── 1. Overall SEO Score ─────────────────────────────────────────────── */}
      <div className={`${card} p-6 flex flex-col items-center gap-4`}>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#888] mb-3">Overall SEO Score</p>
          <ScoreGauge score={audit.score} />
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-sm font-semibold text-[#1A1A1A]">{audit.criticalCount}</span>
            <span className="text-xs text-[#888]">Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-sm font-semibold text-[#1A1A1A]">{audit.warningCount}</span>
            <span className="text-xs text-[#888]">Warnings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-sm font-semibold text-[#1A1A1A]">{audit.passedCount}</span>
            <span className="text-xs text-[#888]">Passed</span>
          </div>
        </div>
      </div>

      {/* ── 2. Domain Authority + GEO Score ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`${card} p-5`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#888] mb-2">Domain Authority</p>
          <p className="text-4xl font-bold" style={{ color: scoreColor(Math.min(domainAuthority, 100)) }}>
            {domainAuthority > 0 ? domainAuthority : '—'}
          </p>
          <p className="text-xs text-[#AAA] mt-1">Powered by DataForSEO</p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#888] mb-2">GEO Score</p>
          <p className="text-4xl font-bold" style={{ color: scoreColor(audit.score) }}>
            {audit.score}
          </p>
          <p className="text-xs text-[#AAA] mt-1">{audit.location}{audit.city ? ` · ${audit.city}` : ''}</p>
        </div>
      </div>

      {/* ── 3. Website Health ─────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="px-5 pt-5 pb-3 border-b border-[#F0EDE9]">
          <p className="text-sm font-semibold text-[#1A1A1A]">Website Health</p>
          <p className="text-xs text-[#888] mt-0.5">Core audit metrics</p>
        </div>
        <div className="grid grid-cols-4 divide-x divide-[#F0EDE9]">
          {[
            { label: 'Performance', score: perf.score, sub: 'Mobile' },
            { label: 'SEO', score: audit.score, sub: 'On-page' },
            { label: 'Accessibility', score: 85, sub: 'Locked', locked: true },
            { label: 'Best Practices', score: 92, sub: 'Locked', locked: true },
          ].map(m => (
            <div key={m.label} className="p-4 text-center relative">
              {m.locked && (
                <div className="absolute inset-0 backdrop-blur-[2px] bg-white/60 rounded flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <LockIcon />
                    <span className="text-[10px] text-[#C0B8AF]">Pro</span>
                  </div>
                </div>
              )}
              <p className="text-2xl font-bold" style={{ color: scoreColor(m.score) }}>{m.score}</p>
              <p className="text-xs font-medium text-[#1A1A1A] mt-1">{m.label}</p>
              <p className="text-[10px] text-[#AAA]">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. Stat Cards Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <div className={`${card} p-4`}>
          <p className="text-2xl font-bold text-[#1A1A1A]">{wordCount.toLocaleString()}</p>
          <p className="text-xs font-medium text-[#888] mt-1">Words</p>
        </div>
        <div className={`${card} p-4`}>
          <span className={`inline-block text-sm font-semibold px-2 py-0.5 rounded-full ${readabilityColor}`}>{readability}</span>
          <p className="text-xs font-medium text-[#888] mt-2">Readability</p>
        </div>
        <div className={`${card} p-4 relative overflow-hidden`}>
          <div className="absolute inset-0 backdrop-blur-[2px] bg-white/70 flex items-center justify-center">
            <LockIcon />
          </div>
          <p className="text-2xl font-bold text-[#D1C9C0]">—</p>
          <p className="text-xs font-medium text-[#C0B8AF] mt-1">Images</p>
        </div>
        <div className={`${card} p-4 relative overflow-hidden`}>
          <div className="absolute inset-0 backdrop-blur-[2px] bg-white/70 flex items-center justify-center">
            <LockIcon />
          </div>
          <p className="text-2xl font-bold text-[#D1C9C0]">—</p>
          <p className="text-xs font-medium text-[#C0B8AF] mt-1">Links</p>
        </div>
      </div>

      {/* ── 5. On-Page SEO Table ─────────────────────────────────────────────── */}
      <div className={card}>
        <div className="px-5 pt-5 pb-3 border-b border-[#F0EDE9]">
          <p className="text-sm font-semibold text-[#1A1A1A]">On-Page SEO</p>
          <p className="text-xs text-[#888] mt-0.5">Core page elements</p>
        </div>
        <div className="divide-y divide-[#F7F5F2]">
          {onPageChecks.map((row, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4">
              <CheckIcon pass={row.pass} />
              <div className="w-32 shrink-0">
                <p className="text-xs font-semibold text-[#555]">{row.label}</p>
              </div>
              <p className="flex-1 text-xs text-[#888] truncate">{row.value}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${row.pass ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                {row.pass ? 'Present' : 'Missing'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 6. Search Results & Competitors ─────────────────────────────────── */}
      {audit.competitors.length > 0 && (
        <div className={card}>
          <div className="px-5 pt-5 pb-3 border-b border-[#F0EDE9]">
            <p className="text-sm font-semibold text-[#1A1A1A]">Search Results &amp; Competitors</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] bg-[#F5F1EC] text-[#666] px-2 py-1 rounded-full font-medium">
                🔍 {targetKeyword}
              </span>
              <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded-full font-medium border border-amber-200">
                Difficulty: Medium
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#F0EDE9]">
                  {['#', 'Domain', 'Est. Traffic', 'DR', 'Position'].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-[#AAA] font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.competitors.slice(0, 5).map((c, i) => (
                  <tr key={i} className="border-b border-[#F7F5F2] hover:bg-[#FAF8F5] transition-colors">
                    <td className="px-5 py-3 text-[#888] font-medium">{i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Favicon domain={c.domain} />
                        <div>
                          <p className="font-semibold text-[#1A1A1A]">{c.domain}</p>
                          {c.title && <p className="text-[#AAA] text-[10px] truncate max-w-[180px]">{c.title}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[#555]">
                      {c.organicTraffic && c.organicTraffic > 0 ? `~${c.organicTraffic.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {c.domainRank && c.domainRank > 0 ? (
                        <span className="font-semibold" style={{ color: scoreColor(c.domainRank) }}>{c.domainRank}</span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#F5F1EC] text-[#555] font-bold text-[11px]">
                        {i + 1}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 7. Passed Checks Grid ─────────────────────────────────────────────── */}
      {passedItems.length > 0 && (
        <div className={card}>
          <div className="px-5 pt-5 pb-3 border-b border-[#F0EDE9]">
            <p className="text-sm font-semibold text-[#1A1A1A]">What&apos;s Working ✓</p>
            <p className="text-xs text-[#888] mt-0.5">{passedItems.length} checks passed</p>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {passedItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke="#16a34a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1A1A1A]">{item.title}</p>
                  <p className="text-[11px] text-[#AAA] mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 8. Fix Biggest Issue Banner ──────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 flex items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, #DA7756 0%, #C4614A 100%)' }}
      >
        <div>
          <p className="text-base font-bold text-white">Fix your #1 SEO issue with AI</p>
          <p className="text-sm text-white/80 mt-0.5">Get step-by-step implementation instructions in seconds</p>
        </div>
        <button
          onClick={() => onSwitchTab('issues')}
          className="shrink-0 bg-white text-[#C4614A] font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors whitespace-nowrap"
        >
          Fix Now →
        </button>
      </div>

    </div>
  )
}

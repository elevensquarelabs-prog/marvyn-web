'use client'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditData = {
  domain: string
  location: string
  city?: string
  score: number | null
  scoreSource?: 'dataforseo_onpage'
  criticalCount: number
  warningCount: number
  passedCount: number
  organicTraffic?: number
  organicKeywords?: number
  trafficSource?: 'gsc' | 'estimated' | null
  estimatedMetrics?: {
    organicTraffic?: number
    organicKeywords?: number
    source: 'dataforseo_labs'
  }
  pageData: {
    title: string
    h1: string
    description: string
    keywords: string
    onpageScore: number
    headings: string[]
  }
  crawlSummary?: {
    pagesRequested: number
    pagesCrawled: number
    pagesReturned: number
    renderedMode: boolean
    screenshotUrl?: string
  }
  crawledPages?: Array<{
    url: string
    title?: string
    statusCode?: number
    level?: number
    wordCount?: number
    contentLength?: number
    internalLinks?: number
    externalLinks?: number
    brokenResources?: number
    onpageScore?: number
    issuesCount?: number
    isHomepage?: boolean
  }>
  issues: Array<{ severity: string; category: string; title: string; recommendation: string }>
  competitors: Array<{
    domain: string
    title: string
    url: string
    description?: string
    organicTraffic?: number
    organicKeywords?: number
    domainRank?: number
  }>
  performance: {
    score: number
    accessibility?: number
    bestPractices?: number
    lighthouseSeo?: number
    fcp?: string
    lcp?: string
    cls?: string
    tbt?: string
    mobile: boolean
  }
  aiActions: Array<{ priority: string; effort: string; impact: string; title: string; instructions: string[]; type: string; done: boolean }>
  pageKeywords: Array<{ keyword: string; source: string; searchVolume?: number; impressions?: number; difficulty?: number; position?: number }>
  keywordOpportunities?: Array<{ keyword: string; searchVolume?: number; difficulty?: number; cpc?: number; competitionLevel?: string; intent?: string }>
  createdAt: Date
  completedAt?: Date
  status: string
}

interface Props {
  audit: AuditData
  onSwitchTab: (tab: string) => void
  gscStats?: { clicks: number; impressions: number; keywords: number; avgPosition: number }
  pageCtrMap?: Record<string, { clicks: number; impressions: number; ctr: number; position: number }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 70) return '#22c55e'
  if (s >= 40) return '#f59e0b'
  return '#ef4444'
}

function scoreLabel(s: number): string {
  if (s >= 70) return 'Good'
  if (s >= 40) return 'Fair'
  return 'Poor'
}

// ─── Score Arc Gauge ──────────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <div className="w-[144px] h-[130px] flex flex-col items-center justify-center">
        <p className="text-4xl font-bold text-[#555]">—</p>
        <p className="text-[11px] text-[#555] mt-1">Unavailable</p>
      </div>
    )
  }

  const R = 52
  const cx = 72
  const cy = 72
  const startDeg = 150
  const endDeg = 390          // 240° sweep
  const sweep = endDeg - startDeg
  const filled = (score / 100) * sweep

  const toRad = (d: number) => (d * Math.PI) / 180
  const pt = (deg: number) => ({
    x: cx + R * Math.cos(toRad(deg)),
    y: cy + R * Math.sin(toRad(deg)),
  })
  const arc = (sa: number, ea: number) => {
    const s = pt(sa); const e = pt(ea)
    const large = ea - sa > 180 ? 1 : 0
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
  }

  const color = scoreColor(score)

  return (
    <svg width="144" height="130" viewBox="0 0 144 130" aria-label={`SEO score ${score}`} className="score-gauge">
      {/* Track */}
      <path d={arc(startDeg, endDeg)} fill="none" className="gauge-track" strokeWidth="10" strokeLinecap="round" />
      {/* Fill */}
      {score > 0 && (
        <path
          d={arc(startDeg, startDeg + filled)}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          style={{ transition: 'all 1.4s cubic-bezier(.4,0,.2,1)' }}
        />
      )}
      {/* Score */}
      <text x={cx} y={cy + 6} textAnchor="middle" className="gauge-score" fontSize="30" fontWeight="700" fontFamily="Inter, sans-serif">{score}</text>
      <text x={cx} y={cx + 22} textAnchor="middle" className="gauge-sub" fontSize="11" fontFamily="Inter, sans-serif">/100</text>
      <text x={cx} y={cx + 36} textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">{scoreLabel(score)}</text>
    </svg>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex-1 h-1.5 bg-[#1E1E1E] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-1000"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─── Check / X icons ──────────────────────────────────────────────────────────

function CheckIcon({ pass }: { pass: boolean }) {
  return pass ? (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20 shrink-0">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5l2.5 2.5 3.5-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 shrink-0">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M3 3l4 4M7 3l-4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
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

// ─── Card wrapper ─────────────────────────────────────────────────────────────

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-[#111111] border border-[#1E1E1E] rounded-2xl ${className}`}>{children}</div>
)

const CardHeader = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="px-5 pt-5 pb-3 border-b border-[#1E1E1E]">
    <p className="text-sm font-semibold text-white">{title}</p>
    {sub && <p className="text-xs text-[#555] mt-0.5">{sub}</p>}
  </div>
)

// ─── Main Component ───────────────────────────────────────────────────────────

function fmtNum(n?: number | null): string {
  if (!n || n <= 0) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toLocaleString()
}

function fmtMoney(n?: number | null): string {
  if (!n || n <= 0) return '—'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function trimUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export default function AuditOverview({ audit, onSwitchTab, gscStats, pageCtrMap }: Props) {
  const pd = audit.pageData
  const perf = audit.performance
  const score = audit.score
  const crawlSummary = audit.crawlSummary
  const crawledPages = audit.crawledPages ?? []
  const topPages = crawledPages
    .slice()
    .sort((a, b) => (a.issuesCount ?? 0) - (b.issuesCount ?? 0) || (b.wordCount ?? 0) - (a.wordCount ?? 0))
    .slice(0, 5)
  const keywordOpportunities = audit.keywordOpportunities ?? []

  // User's own domain traffic
  const orgTraffic = audit.organicTraffic && audit.organicTraffic > 0 ? audit.organicTraffic : null
  const orgKeywords = audit.organicKeywords && audit.organicKeywords > 0 ? audit.organicKeywords : null
  const estimatedTraffic = audit.estimatedMetrics?.organicTraffic && audit.estimatedMetrics.organicTraffic > 0
    ? audit.estimatedMetrics.organicTraffic
    : null
  const estimatedKeywords = audit.estimatedMetrics?.organicKeywords && audit.estimatedMetrics.organicKeywords > 0
    ? audit.estimatedMetrics.organicKeywords
    : null
  const pagesCrawledValue = crawlSummary?.pagesCrawled || crawlSummary?.pagesReturned || 0

  // Website health metrics — treat 0 as missing for performance
  const perfScore = perf?.score && perf.score > 0 ? perf.score : null
  const healthMetrics = [
    { label: 'Performance',   score: perfScore ?? 0,          display: perfScore != null ? String(perfScore) : '—',                    locked: false },
    { label: 'SEO (On-Page)', score: score ?? 0,              display: score != null ? String(score) : '—',                           locked: false },
    { label: 'Accessibility', score: perf.accessibility ?? 0, display: perf.accessibility ? String(perf.accessibility) : '—',         locked: !perf.accessibility },
    { label: 'Best Practices', score: perf.bestPractices ?? 0, display: perf.bestPractices ? String(perf.bestPractices) : '—',        locked: !perf.bestPractices },
  ]

  // On-page checks for the crawled page
  const onPageRows = [
    { label: 'Title Tag', value: pd.title ? pd.title.slice(0, 60) + (pd.title.length > 60 ? '…' : '') : 'Missing', pass: !!pd.title },
    { label: 'Meta Description', value: pd.description ? pd.description.slice(0, 80) + (pd.description.length > 80 ? '…' : '') : 'Missing', pass: !!pd.description },
    { label: 'H1 Heading', value: pd.h1 ? pd.h1.slice(0, 60) + (pd.h1.length > 60 ? '…' : '') : 'Missing', pass: !!pd.h1 },
  ]

  // Target keyword
  const targetKeyword = (pd.h1 || pd.title || audit.domain).split(/\s+/).slice(0, 5).join(' ')

  // Passed checks — derive from what's NOT in issues
  const issueTitlesLower = new Set(audit.issues.map(i => i.title.toLowerCase()))
  const hasViewportAudit = !issueTitlesLower.has('missing viewport meta') && !issueTitlesLower.has('viewport meta missing')
  onPageRows.push({ label: 'Viewport Meta', value: hasViewportAudit ? 'Present' : 'Missing', pass: hasViewportAudit })
  const WELL_KNOWN: Array<{ title: string; sub: string; issueKey: string }> = [
    { title: 'HTTPS Enabled', sub: 'Secure connection active', issueKey: 'page served over http' },
    { title: 'Title Tag Present', sub: 'Visible in search results', issueKey: 'missing title tag' },
    { title: 'Meta Description', sub: 'Snippet shows in SERP', issueKey: 'missing meta description' },
    { title: 'H1 Tag Present', sub: 'Primary keyword heading', issueKey: 'no h1 heading found' },
    { title: 'Viewport Tag', sub: 'Mobile-friendly layout', issueKey: 'missing viewport meta' },
    { title: 'No Redirect Chains', sub: 'Direct URLs only', issueKey: 'redirect chain detected' },
    { title: 'Charset Declared', sub: 'UTF-8 meta present', issueKey: 'missing charset meta tag' },
    { title: 'No Broken Links', sub: 'All links returning 200', issueKey: 'page returns error' },
  ]
  const passedItems = WELL_KNOWN.filter(w => !issueTitlesLower.has(w.issueKey)).slice(0, 6)
  const seriousPages = crawledPages.filter(page => (page.statusCode && page.statusCode >= 400) || (page.issuesCount ?? 0) >= 3).length
  const renderedLabel = crawlSummary?.renderedMode ? 'JS + browser rendering enabled' : 'HTML crawl only'

  return (
    <div className="space-y-4 w-full">

      {/* ── Row 1: Score (left) + 2×2 cards (right) ─────────────────────────── */}
      {/* 3-col grid: col1=score(rowspan2), col2=DA+PA stacked, col3=Backlinks+Referring stacked */}
      <div className="grid grid-cols-3 grid-rows-2 gap-4">

        {/* Score card — spans both rows on col 1 */}
        <Card className="row-span-2 p-6 flex flex-col items-center gap-5">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">Overall SEO Score</p>
            <ScoreArc score={score} />
          </div>
          <div className="w-full grid grid-cols-3 gap-2 pt-1 border-t border-[#1E1E1E]">
            {[
              { dot: 'bg-red-500',   val: audit.criticalCount, label: 'Critical' },
              { dot: 'bg-amber-400', val: audit.warningCount,  label: 'Warnings' },
              { dot: 'bg-green-500', val: audit.passedCount,   label: 'Passed' },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center gap-1 pt-3">
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
                  <span className="text-sm font-bold text-white">{s.val}</span>
                </div>
                <span className="text-[10px] text-[#555]">{s.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Organic Traffic — col 2, row 1 */}
        <Card className="col-start-2 row-start-1 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555]">Clicks (GSC)</p>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-green-900/30 text-green-400">GSC</span>
          </div>
          <p className="text-4xl font-bold mt-2" style={{ color: gscStats?.clicks ? '#22c55e' : orgTraffic ? '#22c55e' : '#555' }}>
            {gscStats?.clicks ? fmtNum(gscStats.clicks) : orgTraffic ? fmtNum(orgTraffic) : '—'}
          </p>
          <p className="text-[10px] text-[#555] mt-1">
            {gscStats ? 'Total clicks from Search Console' : 'Sync GSC to see real data'}
          </p>
        </Card>

        {/* Impressions — col 3, row 1 */}
        <Card className="col-start-3 row-start-1 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555]">Impressions (GSC)</p>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-green-900/30 text-green-400">GSC</span>
          </div>
          <p className="text-4xl font-bold mt-2" style={{ color: gscStats?.impressions ? '#DA7756' : '#555' }}>
            {gscStats?.impressions ? fmtNum(gscStats.impressions) : '—'}
          </p>
          <p className="text-[10px] text-[#555] mt-1">
            {gscStats ? 'Total impressions from Google' : 'Sync GSC to see real data'}
          </p>
        </Card>

        {/* Estimated Traffic — col 2, row 2 */}
        <Card className="col-start-2 row-start-2 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555]">Est. Organic Traffic</p>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-400">Estimate</span>
          </div>
          <p className="text-4xl font-bold mt-2" style={{ color: estimatedTraffic ? '#DA7756' : '#555' }}>
            {fmtNum(estimatedTraffic)}
          </p>
          <p className="text-[10px] text-[#555] mt-1">
            DataForSEO Labs estimated monthly traffic
          </p>
        </Card>

        {/* Tracked Keywords — col 3, row 2 */}
        <Card className="col-start-3 row-start-2 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555]">Tracked Keywords</p>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${gscStats ? 'bg-green-900/30 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {gscStats ? 'GSC' : 'Estimate'}
            </span>
          </div>
          <p className="text-4xl font-bold mt-2" style={{ color: gscStats?.keywords || orgKeywords || estimatedKeywords ? '#22c55e' : '#555' }}>
            {gscStats?.keywords ? fmtNum(gscStats.keywords) : fmtNum(orgKeywords ?? estimatedKeywords)}
          </p>
          <p className="text-[10px] text-[#555] mt-1">
            {gscStats ? 'Queries with impressions in Search Console' : 'Estimated ranking footprint from DataForSEO'}
          </p>
        </Card>

      </div>

      {/* ── Website Health ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Website Health" sub="Core Lighthouse metrics" />
        <div className="p-5 space-y-4">
          {healthMetrics.map(m => (
            <div key={m.label} className="relative">
              {m.locked && (
                <div className="absolute inset-0 flex items-center justify-end pr-1 z-10">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="1.5" y="5.5" width="9" height="6" rx="1.5" fill="#333" />
                    <path d="M3.5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              <div className={`flex items-center gap-3 ${m.locked ? 'opacity-40' : ''}`}>
                <span className="text-xs text-[#A0A0A0] w-28 shrink-0">{m.label}</span>
                <ProgressBar value={m.display === '—' ? 0 : m.score} color={scoreColor(m.score)} />
                <span className="text-xs font-semibold w-8 text-right shrink-0" style={{ color: m.display === '—' ? '#555' : scoreColor(m.score) }}>
                  {m.display}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── On-Page SEO Table ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="On-Page SEO" sub={`Crawled: ${audit.domain}`} />
        <div>
          {onPageRows.map((row, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4 border-b border-[var(--border)] last:border-0">
              <CheckIcon pass={row.pass} />
              <span className="text-xs font-medium text-[#A0A0A0] w-36 shrink-0">{row.label}</span>
              <span className="flex-1 text-xs text-[#555] truncate">{row.value}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                row.pass ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {row.pass ? 'Present' : 'Missing'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Audit Coverage" sub="How much of the site was actually reviewed" />
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Pages requested', value: crawlSummary?.pagesRequested ?? 0 },
                { label: 'Pages crawled', value: pagesCrawledValue },
                { label: 'Pages surfaced', value: crawlSummary?.pagesReturned ?? 0 },
                { label: 'Pages needing attention', value: seriousPages },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555]">{item.label}</p>
                  <p className="text-2xl font-bold text-white mt-2">{item.value || '—'}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] px-4 py-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555]">Render mode</p>
                <p className="text-sm font-semibold text-white mt-2">{renderedLabel}</p>
                <p className="text-[11px] text-[#555] mt-1">Modern JS-heavy pages are audited with rendered HTML, not just raw source.</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${crawlSummary?.renderedMode ? 'bg-green-500/10 text-green-400' : 'bg-[#2A2A2A] text-[#A0A0A0]'}`}>
                {crawlSummary?.renderedMode ? 'Rendered' : 'HTML only'}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Audit Proof" sub="Visual confirmation of the rendered page" />
          <div className="p-5">
            {crawlSummary?.screenshotUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={crawlSummary.screenshotUrl}
                  alt={`Screenshot of ${audit.domain}`}
                  className="w-full h-44 object-cover rounded-xl border border-[#1E1E1E] bg-[#0D0D0D]"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-[#A0A0A0]">Rendered homepage screenshot captured during the crawl.</p>
                  <a
                    href={crawlSummary.screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[#DA7756] hover:text-[#C4633F] transition-colors whitespace-nowrap"
                  >
                    Open full image →
                  </a>
                </div>
              </div>
            ) : (
              <div className="h-44 rounded-xl border border-dashed border-[#2A2A2A] bg-[#0D0D0D] flex flex-col items-center justify-center text-center px-6">
                <p className="text-sm font-medium text-[#A0A0A0]">No screenshot captured</p>
                <p className="text-xs text-[#555] mt-1">The crawl still ran in rendered mode, but no screenshot URL was returned by DataForSEO.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {topPages.length > 0 && (
        <Card>
          <CardHeader
            title="Top Crawled Pages"
            sub={pageCtrMap && Object.keys(pageCtrMap).length > 0 ? 'Page-level signals + GSC clicks & CTR' : 'Best available page-level signals from the audit'}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Page', 'Status', 'Words', 'Issues', 'Score', 'Clicks', 'CTR'].map(header => (
                    <th key={header} className="text-left px-5 py-3 text-[#555] font-semibold uppercase tracking-wide text-[10px]">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topPages.map(page => {
                  const gsc = pageCtrMap?.[page.url]
                  return (
                    <tr key={page.url} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-5 py-3">
                        <div className="max-w-[280px]">
                          <p className="font-semibold text-white truncate">{page.title || trimUrl(page.url)}</p>
                          <p className="text-[#555] text-[10px] truncate">{trimUrl(page.url)}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${page.statusCode && page.statusCode >= 400 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                          {page.statusCode ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#A0A0A0]">{fmtNum(page.wordCount)}</td>
                      <td className="px-5 py-3 text-[#A0A0A0]">{fmtNum(page.issuesCount)}</td>
                      <td className="px-5 py-3 font-semibold" style={{ color: scoreColor(page.onpageScore ?? 0) }}>
                        {page.onpageScore ? Math.round(page.onpageScore) : '—'}
                      </td>
                      <td className="px-5 py-3 font-semibold text-white">
                        {gsc ? fmtNum(gsc.clicks) : <span className="text-[#333]">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {gsc ? (
                          <span className={`font-semibold ${gsc.ctr >= 0.05 ? 'text-green-400' : gsc.ctr >= 0.02 ? 'text-yellow-400' : 'text-[#A0A0A0]'}`}>
                            {(gsc.ctr * 100).toFixed(1)}%
                          </span>
                        ) : <span className="text-[#333]">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {pageCtrMap && Object.keys(pageCtrMap).length === 0 && (
            <p className="px-5 pb-4 text-[10px] text-[#444]">Sync Google Search Console to see per-page clicks and CTR</p>
          )}
        </Card>
      )}

      {/* ── Competitor Table ──────────────────────────────────────────────────── */}
      {audit.competitors.length > 0 && (
        <Card>
          <div className="px-5 pt-5 pb-3 border-b border-[#1E1E1E] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Search Results &amp; Competitors</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] bg-[#DA7756]/10 text-[#DA7756] px-2 py-1 rounded-full font-medium border border-[#DA7756]/20">
                  🔍 {targetKeyword}
                </span>
                {estimatedKeywords ? (
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full font-medium border border-amber-500/20">
                    Est. footprint: {fmtNum(estimatedKeywords)} keywords
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['#', 'Domain', 'Monthly Traffic', 'Keywords'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[#555] font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.competitors.slice(0, 5).map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <td className="px-5 py-3 text-[#555] font-medium">{i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Favicon domain={c.domain} />
                        <div>
                          <p className="font-semibold text-white">{c.domain}</p>
                          {c.title && (
                            <p className="text-[#555] text-[10px] truncate max-w-[160px]">{c.title}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-semibold text-white">
                      {c.organicTraffic && c.organicTraffic > 0
                        ? fmtNum(c.organicTraffic)
                        : <span className="text-[#555] font-normal">—</span>}
                    </td>
                    <td className="px-5 py-3 text-[#A0A0A0]">
                      {c.organicKeywords && c.organicKeywords > 0
                        ? fmtNum(c.organicKeywords)
                        : <span className="text-[#555]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {keywordOpportunities.length > 0 && (
        <Card>
          <CardHeader title="Keyword Opportunities" sub="DataForSEO Labs ideas for additional reach" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Keyword', 'Search Volume', 'Difficulty', 'CPC', 'Intent'].map(header => (
                    <th key={header} className="text-left px-5 py-3 text-[#555] font-semibold uppercase tracking-wide text-[10px]">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keywordOpportunities.slice(0, 8).map(item => (
                  <tr key={item.keyword} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-white">{item.keyword}</p>
                      {item.competitionLevel ? <p className="text-[10px] text-[#555] mt-0.5">Competition: {item.competitionLevel}</p> : null}
                    </td>
                    <td className="px-5 py-3 text-[#A0A0A0]">{fmtNum(item.searchVolume)}</td>
                    <td className="px-5 py-3">
                      <span className="text-[#A0A0A0]">{item.difficulty != null ? `${item.difficulty}` : '—'}</span>
                    </td>
                    <td className="px-5 py-3 text-[#A0A0A0]">{fmtMoney(item.cpc)}</td>
                    <td className="px-5 py-3 text-[#A0A0A0]">{item.intent ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Passed Checks Grid ───────────────────────────────────────────────── */}
      {passedItems.length > 0 && (
        <Card>
          <CardHeader title="What's Working ✓" sub={`${passedItems.length} checks passed`} />
          <div className="p-5 grid grid-cols-2 gap-4">
            {passedItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke="#22c55e" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{item.title}</p>
                  <p className="text-[11px] text-[#555] mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Fix Banner ────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 flex items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, #DA7756 0%, #C4633F 100%)' }}
      >
        <div>
          <p className="text-base font-bold text-white">Fix your #1 SEO issue with AI</p>
          <p className="text-sm text-white/75 mt-0.5">Get step-by-step implementation instructions in seconds</p>
        </div>
        <button
          onClick={() => onSwitchTab('issues')}
          className="shrink-0 bg-white/15 hover:bg-white/25 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap border border-white/20"
        >
          Fix Now →
        </button>
      </div>

    </div>
  )
}

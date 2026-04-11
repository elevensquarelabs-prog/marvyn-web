'use client'

import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrawledPage {
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
}

export interface PageCtr {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface Props {
  crawledPages: CrawledPage[]
  pageCtrMap: Record<string, PageCtr>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trimUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function pathOnly(url: string): string {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return url
  }
}

function fmtNum(n?: number | null): string {
  if (n == null || n <= 0) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toLocaleString()
}

function scoreColor(s: number): string {
  if (s >= 70) return '#22c55e'
  if (s >= 40) return '#f59e0b'
  return '#ef4444'
}

function ctrColor(ctr: number): string {
  if (ctr >= 0.05) return '#22c55e'
  if (ctr >= 0.02) return '#f59e0b'
  return '#ef4444'
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type PageSortKey = 'score' | 'issues' | 'words' | 'url' | 'status' | 'ctr' | 'clicks'
type SortDir = 'asc' | 'desc'

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg
      width="8" height="8" viewBox="0 0 8 8" fill="none"
      className={`ml-1 inline shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-20'}`}
    >
      {dir === 'asc'
        ? <path d="M4 1l3 5H1z" fill="currentColor" />
        : <path d="M4 7L1 2h6z" fill="currentColor" />}
    </svg>
  )
}

// ─── CTR Opportunities ────────────────────────────────────────────────────────

function CtrOpportunitiesSection({ pageCtrMap }: { pageCtrMap: Record<string, PageCtr> }) {
  const [showAll, setShowAll] = useState(false)
  const PREVIEW = 10

  const rows = useMemo(() => {
    return Object.entries(pageCtrMap)
      .map(([url, d]) => ({ url, ...d, opportunity: d.impressions * (1 - d.ctr) }))
      .sort((a, b) => b.opportunity - a.opportunity)
  }, [pageCtrMap])

  if (rows.length === 0) return null

  const visible = showAll ? rows : rows.slice(0, PREVIEW)
  const avgCtr = rows.reduce((s, r) => s + r.ctr, 0) / rows.length

  return (
    <div className="bg-[#111111] border border-[#1E1E1E] rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-[#1E1E1E]">
        <p className="text-sm font-semibold text-white">CTR Opportunities</p>
        <p className="text-xs text-[#555] mt-0.5">
          Pages ordered by missed clicks — high impressions with below-average CTR are your biggest wins.
          Avg CTR across {rows.length} pages: <span className="text-[#A0A0A0]">{(avgCtr * 100).toFixed(1)}%</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1E1E1E] bg-[#0D0D0D]">
              {['Page', 'Impressions', 'Clicks', 'CTR', 'Avg Position'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.url} className="border-b border-[#1A1A1A] last:border-0 hover:bg-[#161616] transition-colors">
                <td className="px-5 py-3 max-w-[340px]">
                  <p className="font-semibold text-white truncate" title={row.url}>{pathOnly(row.url)}</p>
                  <p className="text-[#555] text-[10px] truncate">{trimUrl(row.url)}</p>
                </td>
                <td className="px-5 py-3 font-semibold text-white">{fmtNum(row.impressions)}</td>
                <td className="px-5 py-3 text-[#A0A0A0]">{fmtNum(row.clicks)}</td>
                <td className="px-5 py-3">
                  <span className="font-semibold" style={{ color: ctrColor(row.ctr) }}>
                    {(row.ctr * 100).toFixed(1)}%
                  </span>
                  {row.ctr < avgCtr && (
                    <span className="ml-1.5 text-[10px] text-red-400/70">↓ below avg</span>
                  )}
                </td>
                <td className="px-5 py-3 text-[#A0A0A0]">
                  {row.position > 0 ? row.position.toFixed(1) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PREVIEW && (
        <div className="px-5 py-3 border-t border-[#1E1E1E]">
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs text-[#DA7756] hover:underline"
          >
            {showAll ? 'Show fewer' : `Show all ${rows.length} pages`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Crawled Pages Table ──────────────────────────────────────────────────────

function CrawledPagesTable({ pages, pageCtrMap }: { pages: CrawledPage[]; pageCtrMap: Record<string, PageCtr> }) {
  const [sortKey, setSortKey] = useState<PageSortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'errors'>('all')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const PREVIEW = 25

  const handleSort = (key: PageSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'url' ? 'asc' : 'asc')
    }
  }

  const filtered = useMemo(() => {
    let rows = pages
    if (statusFilter === 'ok') rows = rows.filter(p => !p.statusCode || p.statusCode < 400)
    if (statusFilter === 'errors') rows = rows.filter(p => p.statusCode && p.statusCode >= 400)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(p => p.url.toLowerCase().includes(q) || (p.title ?? '').toLowerCase().includes(q))
    }
    return rows
  }, [pages, statusFilter, search])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'score':   return dir * ((a.onpageScore ?? -1) - (b.onpageScore ?? -1))
        case 'issues':  return dir * ((a.issuesCount ?? 0) - (b.issuesCount ?? 0))
        case 'words':   return dir * ((a.wordCount ?? 0) - (b.wordCount ?? 0))
        case 'status':  return dir * ((a.statusCode ?? 200) - (b.statusCode ?? 200))
        case 'url':     return dir * a.url.localeCompare(b.url)
        case 'ctr': {
          const ac = pageCtrMap[a.url]?.ctr ?? -1
          const bc = pageCtrMap[b.url]?.ctr ?? -1
          return dir * (ac - bc)
        }
        case 'clicks': {
          const ac = pageCtrMap[a.url]?.clicks ?? -1
          const bc = pageCtrMap[b.url]?.clicks ?? -1
          return dir * (ac - bc)
        }
        default: return 0
      }
    })
  }, [filtered, sortKey, sortDir, pageCtrMap])

  const visible = showAll ? sorted : sorted.slice(0, PREVIEW)
  const hasCtrData = Object.keys(pageCtrMap).length > 0
  const errorCount = pages.filter(p => p.statusCode && p.statusCode >= 400).length

  const Th = ({ label, sortable, k }: { label: string; sortable?: boolean; k?: PageSortKey }) => (
    <th
      onClick={sortable && k ? () => handleSort(k) : undefined}
      className={`text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555] whitespace-nowrap ${sortable ? 'cursor-pointer hover:text-[#A0A0A0] select-none' : ''}`}
    >
      {label}
      {sortable && k && <SortArrow active={sortKey === k} dir={sortKey === k ? sortDir : 'asc'} />}
    </th>
  )

  return (
    <div className="bg-[#111111] border border-[#1E1E1E] rounded-2xl overflow-hidden">
      {/* Controls */}
      <div className="px-5 pt-5 pb-4 border-b border-[#1E1E1E] flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-white">All Crawled Pages</p>
          <p className="text-xs text-[#555] mt-0.5">{pages.length} pages · click column headers to sort</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by URL or title…"
            className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#444] outline-none focus:border-[#DA7756]/50 w-52"
          />
          <div className="flex rounded-lg overflow-hidden border border-[#2A2A2A]">
            {([
              { key: 'all', label: `All (${pages.length})` },
              { key: 'ok', label: `OK (${pages.length - errorCount})` },
              { key: 'errors', label: `Errors (${errorCount})` },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  statusFilter === f.key
                    ? 'bg-[#DA7756]/20 text-[#DA7756]'
                    : 'bg-[#0D0D0D] text-[#555] hover:text-[#A0A0A0]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1E1E1E] bg-[#0D0D0D]">
              <Th label="Page" sortable k="url" />
              <Th label="Status" sortable k="status" />
              <Th label="Score" sortable k="score" />
              <Th label="Issues" sortable k="issues" />
              <Th label="Words" sortable k="words" />
              <Th label="Int. Links" />
              <Th label="Broken Res." />
              <Th label="Title" />
              {hasCtrData && <Th label="Clicks" sortable k="clicks" />}
              {hasCtrData && <Th label="CTR" sortable k="ctr" />}
            </tr>
          </thead>
          <tbody>
            {visible.map((page) => {
              const gsc = pageCtrMap[page.url]
              const hasError = page.statusCode && page.statusCode >= 400
              return (
                <tr
                  key={page.url}
                  className="border-b border-[#1A1A1A] last:border-0 hover:bg-[#161616] transition-colors"
                >
                  <td className="px-4 py-3 max-w-[300px]">
                    <div>
                      <p className="font-semibold text-white truncate" title={page.url}>
                        {page.isHomepage ? '/ (home)' : pathOnly(page.url)}
                      </p>
                      {page.title && (
                        <p className="text-[#555] text-[10px] truncate mt-0.5">{page.title}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      hasError ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                    }`}>
                      {page.statusCode ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: page.onpageScore ? scoreColor(page.onpageScore) : '#555' }}>
                    {page.onpageScore ? Math.round(page.onpageScore) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {(page.issuesCount ?? 0) > 0
                      ? <span className="text-red-400 font-semibold">{page.issuesCount}</span>
                      : <span className="text-[#555]">0</span>}
                  </td>
                  <td className="px-4 py-3 text-[#A0A0A0]">{fmtNum(page.wordCount)}</td>
                  <td className="px-4 py-3 text-[#A0A0A0]">{fmtNum(page.internalLinks)}</td>
                  <td className="px-4 py-3">
                    {(page.brokenResources ?? 0) > 0
                      ? <span className="text-red-400 font-semibold">{page.brokenResources}</span>
                      : <span className="text-[#555]">0</span>}
                  </td>
                  <td className="px-4 py-3">
                    {page.title
                      ? <span className="text-green-400 font-semibold">✓</span>
                      : <span className="text-red-400 font-semibold">✗</span>}
                  </td>
                  {hasCtrData && (
                    <td className="px-4 py-3 text-[#A0A0A0]">
                      {gsc ? fmtNum(gsc.clicks) : <span className="text-[#333]">—</span>}
                    </td>
                  )}
                  {hasCtrData && (
                    <td className="px-4 py-3">
                      {gsc
                        ? <span className="font-semibold" style={{ color: ctrColor(gsc.ctr) }}>{(gsc.ctr * 100).toFixed(1)}%</span>
                        : <span className="text-[#333]">—</span>}
                    </td>
                  )}
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={hasCtrData ? 10 : 8} className="px-5 py-10 text-center text-[#555] text-xs">
                  No pages match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > PREVIEW && (
        <div className="px-5 py-3 border-t border-[#1E1E1E] flex items-center justify-between">
          <p className="text-xs text-[#555]">Showing {visible.length} of {sorted.length} pages</p>
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs text-[#DA7756] hover:underline"
          >
            {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PagesPanel({ crawledPages, pageCtrMap }: Props) {
  const hasCtrData = Object.keys(pageCtrMap).length > 0
  const hasPages = crawledPages.length > 0

  if (!hasPages && !hasCtrData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-[#555]">No page data available.</p>
        <p className="text-xs text-[#444] mt-1">Run an audit to crawl pages, then sync Google Search Console for CTR data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 w-full">
      {hasCtrData && <CtrOpportunitiesSection pageCtrMap={pageCtrMap} />}
      {hasPages && <CrawledPagesTable pages={crawledPages} pageCtrMap={pageCtrMap} />}
      {hasCtrData && !hasPages && (
        <p className="text-xs text-[#555] px-1">
          GSC page data loaded. Run an audit to enrich these pages with on-page scores.
        </p>
      )}
    </div>
  )
}

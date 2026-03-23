'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Keyword {
  keyword: string
  source: string
  position?: number
  searchVolume?: number
  difficulty?: number
}

interface KeywordsTableProps {
  keywords: Keyword[]
  domain: string
  gscConnected?: boolean
  gscSiteUrl?: string
  syncing?: boolean
  onSync?: () => void
}

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_STYLES: Record<string, string> = {
  h1:   'bg-[#DA7756]/15 text-[#DA7756] border-[#DA7756]/20',
  h2:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
  h3:   'bg-purple-500/15 text-purple-400 border-purple-500/20',
  meta: 'bg-[#2A2A2A] text-[#A0A0A0] border-[#333]',
  gsc:  'bg-green-500/15 text-green-400 border-green-500/20',
}

function SourceBadge({ source }: { source: string }) {
  const key = source.toLowerCase()
  const cls = SOURCE_STYLES[key] ?? SOURCE_STYLES.meta
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${cls}`}>
      {source}
    </span>
  )
}

// ─── Position cell ────────────────────────────────────────────────────────────

function PositionCell({ position }: { position?: number }) {
  if (position == null) return <span className="text-[#555] text-sm">—</span>
  const color = position <= 10 ? 'text-green-400' : position <= 30 ? 'text-amber-400' : 'text-red-400'
  return <span className={`text-sm font-semibold ${color}`}>#{position}</span>
}

// ─── Difficulty bar ───────────────────────────────────────────────────────────

function DifficultyCell({ difficulty }: { difficulty?: number }) {
  if (difficulty == null) return <span className="text-[#555] text-sm">—</span>
  const color = difficulty <= 30 ? '#22c55e' : difficulty <= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${difficulty}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium" style={{ color }}>{difficulty}</span>
    </div>
  )
}

// ─── GSC Banner ───────────────────────────────────────────────────────────────

function GSCBanner({
  gscConnected,
  gscSiteUrl,
  syncing,
  onSync,
  onDismiss,
}: {
  gscConnected: boolean
  gscSiteUrl: string
  syncing: boolean
  onSync: () => void
  onDismiss: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/8 border border-blue-500/20 rounded-xl mb-4">
      <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="#60a5fa" strokeWidth="1.2" />
          <path d="M7 4v3l1.5 1.5" stroke="#60a5fa" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="flex-1 text-xs text-[#A0A0A0]">
        {gscConnected
          ? <><span className="text-white font-medium">{gscSiteUrl}</span>{' '}connected — sync to pull real position data.</>
          : <><span className="text-white font-medium">Connect Google Search Console</span>{' '}to unlock real position data.</>
        }
      </p>
      {gscConnected ? (
        <button
          onClick={onSync}
          disabled={syncing}
          className="shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync data →'}
        </button>
      ) : (
        <a
          href="/settings"
          className="shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg px-3 py-1.5 transition-colors"
        >
          Go to Settings →
        </a>
      )}
      <button onClick={onDismiss} className="shrink-0 text-[#555] hover:text-[#A0A0A0] transition-colors">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KeywordsTable({
  keywords,
  domain,
  gscConnected = false,
  gscSiteUrl = '',
  syncing = false,
  onSync,
}: KeywordsTableProps) {
  const router = useRouter()
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const hasGSCData = keywords.some(k => k.position != null || k.searchVolume != null)

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = [...keywords].sort((a, b) => {
    if (!sortCol) return 0
    let av: number, bv: number
    if (sortCol === 'position') { av = a.position ?? 999; bv = b.position ?? 999 }
    else if (sortCol === 'volume') { av = a.searchVolume ?? 0; bv = b.searchVolume ?? 0 }
    else if (sortCol === 'difficulty') { av = a.difficulty ?? 0; bv = b.difficulty ?? 0 }
    else return 0
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-[#333]">
      {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  return (
    <div className="w-full flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Page Keywords</h3>
          <p className="text-xs text-[#555] mt-0.5">Extracted from <span className="text-[#A0A0A0]">{domain}</span></p>
        </div>
        {gscConnected ? (
          <button
            onClick={onSync}
            disabled={syncing}
            className="shrink-0 text-xs font-medium text-[#A0A0A0] hover:text-white border border-[#2A2A2A] hover:border-[#3A3A3A] rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 6A4 4 0 1 1 6 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M10 2v4H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {syncing ? 'Syncing…' : 'Sync GSC'}
          </button>
        ) : (
          <a
            href="/settings"
            className="shrink-0 text-xs font-medium text-[#A0A0A0] hover:text-white border border-[#2A2A2A] hover:border-[#3A3A3A] rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5"
          >
            Connect GSC →
          </a>
        )}
      </div>

      {/* GSC Banner */}
      {!hasGSCData && !bannerDismissed && (
        <GSCBanner
          gscConnected={gscConnected}
          gscSiteUrl={gscSiteUrl}
          syncing={syncing}
          onSync={onSync ?? (() => {})}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* Table */}
      <div className="bg-[#111111] border border-[#1E1E1E] rounded-2xl overflow-hidden">
        {keywords.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#1A1A1A] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="#555" strokeWidth="1.5" />
                <path d="M13.5 13.5L17 17" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#555]">No keywords extracted</p>
            <p className="text-xs text-[#333]">Run the audit to extract page keywords</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E1E] bg-[#0D0D0D]">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555]">Keyword</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555]">Source</th>
                  <th
                    className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555] cursor-pointer hover:text-[#A0A0A0] select-none"
                    onClick={() => toggleSort('position')}
                  >
                    Position <SortIcon col="position" />
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555] cursor-pointer hover:text-[#A0A0A0] select-none"
                    onClick={() => toggleSort('volume')}
                  >
                    Volume <SortIcon col="volume" />
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555] cursor-pointer hover:text-[#A0A0A0] select-none"
                    onClick={() => toggleSort('difficulty')}
                  >
                    Difficulty <SortIcon col="difficulty" />
                  </th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555]">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((kw, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[#1A1A1A] hover:bg-[#161616] transition-colors last:border-0 ${
                      i % 2 === 0 ? 'bg-[#111111]' : 'bg-[#0D0D0D]'
                    }`}
                  >
                    <td className="px-5 py-3.5"><span className="font-medium text-white">{kw.keyword}</span></td>
                    <td className="px-4 py-3.5"><SourceBadge source={kw.source} /></td>
                    <td className="px-4 py-3.5"><PositionCell position={kw.position} /></td>
                    <td className="px-4 py-3.5 text-[#A0A0A0]">
                      {kw.searchVolume != null ? kw.searchVolume.toLocaleString() : <span className="text-[#555]">—</span>}
                    </td>
                    <td className="px-4 py-3.5"><DifficultyCell difficulty={kw.difficulty} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => router.push(`/blog?keyword=${encodeURIComponent(kw.keyword)}`)}
                        className="text-xs font-medium text-[#DA7756] hover:text-[#C4633F] transition-colors whitespace-nowrap"
                      >
                        Write Article →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {keywords.length > 0 && (
        <p className="text-xs text-[#555] px-1">
          {keywords.length} keywords
          {keywords.some(k => k.source === 'gsc')
            ? <> · <span className="text-green-400">{keywords.filter(k => k.source === 'gsc').length} from Search Console</span></>
            : <> · {keywords.filter(k => k.source === 'h1').length} H1 · {keywords.filter(k => k.source === 'h2').length} H2 · {keywords.filter(k => k.source === 'h3').length} H3 · {keywords.filter(k => k.source === 'meta').length} meta</>
          }
        </p>
      )}
    </div>
  )
}

'use client'

import { fmtCurrency } from '@/lib/currency'

export interface CampaignInsight {
  id: string
  name: string
  platform: 'meta' | 'google'
  status: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  roas: number | null
  ctr: number
  cpa: number | null
}


function truncate(s: string, n = 30) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
      platform === 'meta' ? 'bg-blue-900/30 text-blue-400' : 'bg-green-900/30 text-green-400'
    }`}>
      {platform === 'meta' ? 'Meta' : 'Google'}
    </span>
  )
}

function ScoreRow({
  c,
  type,
  symbol,
  onPause,
}: {
  c: CampaignInsight
  type: 'top' | 'bottom'
  symbol: string
  onPause?: (id: string) => void
}) {
  const metric = c.roas != null ? `${c.roas.toFixed(2)}x ROAS` : c.cpa != null ? `${fmtCurrency(c.cpa, symbol)} CPA` : '—'

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1A1A1A] transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm text-white truncate font-medium">{truncate(c.name)}</span>
          <PlatformBadge platform={c.platform} />
        </div>
        <div className="flex items-center gap-3 text-xs text-[#555]">
          <span>{fmtCurrency(c.spend, symbol)} spend</span>
          <span>·</span>
          <span className="font-medium text-[#A0A0A0]">{metric}</span>
        </div>
      </div>
      {type === 'top' ? (
        <span className="shrink-0 px-2 py-1 bg-emerald-900/20 text-emerald-400 text-[10px] font-semibold rounded-full border border-emerald-900/30">
          Performing
        </span>
      ) : (
        <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onPause && (
            <button
              onClick={() => onPause(c.id)}
              className="px-2 py-1 bg-[#DA7756]/10 hover:bg-[#DA7756]/20 text-[#DA7756] text-[10px] font-semibold rounded border border-[#DA7756]/30 transition-colors"
            >
              Pause with AI
            </button>
          )}
          <span className="px-2 py-1 bg-red-900/20 text-red-400 text-[10px] font-semibold rounded-full border border-red-900/30">
            Underperforming
          </span>
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="p-3 space-y-2">
          <div className="h-3.5 w-3/4 bg-[#1A1A1A] rounded" />
          <div className="h-3 w-1/2 bg-[#1A1A1A] rounded" />
        </div>
      ))}
    </div>
  )
}

interface Props {
  campaigns: CampaignInsight[]
  loading: boolean
  platformFilter: string
  symbol: string
}

export function CampaignPerformance({ campaigns, loading, platformFilter, symbol }: Props) {
  const filtered = platformFilter === 'all' ? campaigns : campaigns.filter(c => c.platform === platformFilter)

  // Score = roas if available, else inverse cpa (lower cpa = better), else 0
  const scored = filtered.map(c => ({
    ...c,
    score: c.roas ?? (c.cpa ? 1 / c.cpa : 0),
  }))

  // Top: highest score with meaningful spend
  const withSpend = scored.filter(c => c.spend > 0)
  const top = [...withSpend].sort((a, b) => b.score - a.score).slice(0, 3)
  // Bottom: high spend but low performance score
  const bottom = [...withSpend].sort((a, b) => a.score - b.score).slice(0, 3)

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-xs font-semibold text-[#555] uppercase tracking-wider">Top Performers</p>
        </div>
        {loading ? (
          <Skeleton />
        ) : top.length === 0 ? (
          <p className="text-[#555] text-sm text-center py-8">No performance data yet</p>
        ) : (
          <div className="space-y-1">
            {top.map(c => <ScoreRow key={c.id} c={c} type="top" symbol={symbol} />)}
          </div>
        )}
      </div>

      <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <p className="text-xs font-semibold text-[#555] uppercase tracking-wider">Needs Attention</p>
        </div>
        {loading ? (
          <Skeleton />
        ) : bottom.length === 0 ? (
          <p className="text-[#555] text-sm text-center py-8">No campaigns to review</p>
        ) : (
          <div className="space-y-1">
            {bottom.map(c => (
              <ScoreRow
                key={c.id}
                c={c}
                type="bottom"
                symbol={symbol}
                onPause={(id) => console.log('Pause AI recommendation for:', id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

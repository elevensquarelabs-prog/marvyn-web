'use client'

import type { CampaignInsight } from './CampaignPerformance'
import { fmtCurrency } from '@/lib/currency'
import { BrandIcon } from '@/components/shared/BrandIcon'

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toFixed(0)
}

function truncate(s: string, n = 36) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function PerformanceBadge({ ctr }: { ctr: number }) {
  if (ctr > 3)  return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-900/20 text-emerald-400 border border-emerald-900/30">High CTR</span>
  if (ctr > 1)  return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-900/20 text-yellow-400 border border-yellow-900/30">Average</span>
  return              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-900/20 text-red-400 border border-red-900/30">Low CTR</span>
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="w-10 h-10 bg-[#1A1A1A] rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 bg-[#1A1A1A] rounded" />
            <div className="h-3 w-1/2 bg-[#1A1A1A] rounded" />
          </div>
          <div className="h-3.5 w-16 bg-[#1A1A1A] rounded" />
        </div>
      ))}
    </div>
  )
}

// This is a campaign-level CTR snapshot, not true ad-level creative reporting.
interface Props {
  campaigns: CampaignInsight[]
  loading: boolean
  platformFilter: string
  symbol: string
}

export function CreativePerformance({ campaigns, loading, platformFilter, symbol }: Props) {
  const filtered = (platformFilter === 'all' ? campaigns : campaigns.filter(c => c.platform === platformFilter))
    .filter(c => c.spend > 0 && c.impressions > 0)
    .sort((a, b) => b.ctr - a.ctr)
    .slice(0, 5)

  const PLATFORM_BG: Record<string, string> = {
    meta: 'bg-blue-900/30 text-blue-400',
    google: 'bg-green-900/30 text-green-400',
    linkedin: 'bg-cyan-900/30 text-cyan-400',
  }

  return (
    <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
      <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-4">Campaign CTR Snapshot</p>
      <p className="text-[11px] text-[#333] mb-4">
        Ranked from real campaign CTR data. Ad-level creative reporting is not wired yet.
      </p>

      {loading ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[#555] text-sm">No campaign CTR data available</p>
          <p className="text-[#333] text-xs mt-1">We only show this section when the selected platform has campaign-level delivery data.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="grid grid-cols-12 gap-3 px-3 mb-2">
            <div className="col-span-5 text-[10px] text-[#333] uppercase tracking-wider">Campaign</div>
            <div className="col-span-2 text-[10px] text-[#333] uppercase tracking-wider text-right">Impressions</div>
            <div className="col-span-2 text-[10px] text-[#333] uppercase tracking-wider text-right">CTR</div>
            <div className="col-span-2 text-[10px] text-[#333] uppercase tracking-wider text-right">Spend</div>
            <div className="col-span-1" />
          </div>

          <div className="space-y-1">
            {filtered.map((c, i) => (
              <div key={c.id} className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg hover:bg-[#1A1A1A] transition-colors">
                {/* Rank + name */}
                <div className="col-span-5 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${PLATFORM_BG[c.platform]}`}>
                    <BrandIcon brand={c.platform === 'google' ? 'adwords' : c.platform} alt={c.platform} size={18} background={c.platform === 'linkedin' ? 'white' : undefined} rounded={false} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{truncate(c.name)}</p>
                    <p className="text-[10px] text-[#555] capitalize">
                      {c.platform === 'meta' ? 'Meta Ads' : c.platform === 'google' ? 'Google Ads' : 'LinkedIn Ads'} · #{i + 1}
                    </p>
                  </div>
                </div>

                {/* Impressions */}
                <div className="col-span-2 text-right">
                  <span className="text-sm text-[#A0A0A0]">{fmtNum(c.impressions)}</span>
                </div>

                {/* CTR */}
                <div className="col-span-2 text-right">
                  <span className="text-sm text-white font-medium">{c.ctr.toFixed(2)}%</span>
                </div>

                {/* Spend */}
                <div className="col-span-2 text-right">
                  <span className="text-sm text-[#A0A0A0]">{fmtCurrency(c.spend, symbol)}</span>
                </div>

                {/* Badge */}
                <div className="col-span-1 flex justify-end">
                  <PerformanceBadge ctr={c.ctr} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

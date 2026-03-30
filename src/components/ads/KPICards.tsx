'use client'

import { fmtCurrency } from '@/lib/currency'

interface KPIData {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  activeCampaigns: number
  campaignCount: number
  roas: number | null
  ctr: number
  cpa: number | null
  cpc: number | null
  previous: {
    spend: number
    impressions: number
    clicks: number
    conversions: number
    roas: number | null
  }
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return ((curr - prev) / prev) * 100
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toFixed(0)
}


function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[#555] text-xs">no prior data</span>
  const up = pct >= 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
        {up
          ? <path d="M6 2l4 5H2l4-5z" />
          : <path d="M6 10L2 5h8L6 10z" />}
      </svg>
      {Math.abs(pct).toFixed(1)}% vs prior
    </span>
  )
}

interface CardProps {
  label: string
  value: string
  sub?: string
  delta: number | null
  loading?: boolean
}

function KPICard({ label, value, sub, delta, loading }: CardProps) {
  if (loading) {
    return (
      <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5 space-y-3 animate-pulse">
        <div className="h-3 w-24 bg-[#1E1E1E] rounded" />
        <div className="h-8 w-32 bg-[#1E1E1E] rounded" />
        <div className="h-3 w-20 bg-[#1E1E1E] rounded" />
      </div>
    )
  }
  return (
    <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555]">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-[#555]">{sub}</p>}
      <Delta pct={delta} />
    </div>
  )
}

export function KPICards({
  data,
  loading,
  symbol,
  platformFilter,
}: {
  data: KPIData | null
  loading: boolean
  symbol: string
  platformFilter: string
}) {
  const d = data
  const conversionRate = d && d.clicks > 0 ? (d.conversions / d.clicks) * 100 : null
  const secondCard = platformFilter === 'all'
    ? {
        label: 'Blended ROAS',
        value: d?.roas != null ? d.roas.toFixed(2) + 'x' : '—',
        sub: d?.roas == null ? 'No conversion tracking' : undefined,
        delta: d && d.roas != null && d.previous.roas != null ? pctChange(d.roas, d.previous.roas) : null,
      }
    : d?.roas != null
      ? {
          label: 'Platform ROAS',
          value: d.roas.toFixed(2) + 'x',
          sub: 'Revenue attributed from this platform',
          delta: null,
        }
      : {
          label: 'Conversion Rate',
          value: conversionRate != null ? `${conversionRate.toFixed(2)}%` : '—',
          sub: 'Conversions divided by clicks',
          delta: null,
        }

  const cards = [
    {
      label: 'Total Spend',
      value: d ? fmtCurrency(d.spend, symbol) : '—',
      delta: d ? pctChange(d.spend, d.previous.spend) : null,
    },
    secondCard,
    {
      label: 'Impressions',
      value: d ? fmt(d.impressions) : '—',
      delta: d ? pctChange(d.impressions, d.previous.impressions) : null,
    },
    {
      label: 'Clicks',
      value: d ? fmt(d.clicks) : '—',
      sub: d && d.ctr > 0 ? `${d.ctr.toFixed(2)}% CTR` : undefined,
      delta: d ? pctChange(d.clicks, d.previous.clicks) : null,
    },
    {
      label: 'Conversions',
      value: d ? fmt(d.conversions) : '—',
      sub: d?.cpa != null ? `${fmtCurrency(d.cpa, symbol)} CPA` : undefined,
      delta: d ? pctChange(d.conversions, d.previous.conversions) : null,
    },
    {
      label: 'Avg CPC',
      value: d?.cpc != null ? fmtCurrency(d.cpc, symbol) : '—',
      sub: d
        ? d.activeCampaigns > 0
          ? `${d.activeCampaigns} active of ${d.campaignCount} campaigns`
          : `${d.campaignCount} campaigns • all paused`
        : undefined,
      delta: null,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
      {cards.map(c => (
        <KPICard key={c.label} loading={loading} {...c} />
      ))}
    </div>
  )
}

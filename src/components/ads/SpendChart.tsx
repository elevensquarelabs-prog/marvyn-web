'use client'

import { fmtCurrency } from '@/lib/currency'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface DailyEntry { date: string; meta: number; google: number; linkedin: number }
interface PlatformBreakdown {
  meta: { spend: number; impressions: number }
  google: { spend: number; impressions: number }
  linkedin: { spend: number; impressions: number }
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}


function SkeletonBlock({ h = 'h-40' }: { h?: string }) {
  return <div className={`${h} bg-[#1A1A1A] rounded-lg animate-pulse`} />
}

function PlatformBar({ platform, spend, total, color, symbol }: { platform: string; spend: number; total: number; color: string; symbol: string }) {
  const pct = total > 0 ? (spend / total) * 100 : 0
  const logos: Record<string, string> = { meta: 'M', google: 'G', linkedin: 'in' }
  const labels: Record<string, string> = { meta: 'Meta Ads', google: 'Google Ads', linkedin: 'LinkedIn Ads' }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white`} style={{ background: color }}>
            {logos[platform]}
          </span>
          <span className="text-[#A0A0A0] capitalize">{labels[platform] ?? platform}</span>
        </div>
        <div className="text-right">
          <span className="text-white font-medium">{fmtCurrency(spend, symbol)}</span>
          <span className="text-[#555] ml-1.5">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

interface Props {
  dailySpend: DailyEntry[]
  platformBreakdown: PlatformBreakdown
  loading: boolean
  symbol: string
}

function renderTooltip(symbol: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function TooltipContent({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-3 text-xs shadow-xl">
        <p className="text-[#A0A0A0] mb-2">{label}</p>
        {payload.map((p: { color: string; name: string; value: number }) => (
          <div key={p.name} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-[#A0A0A0]">{p.name}:</span>
            <span className="text-white font-medium">{fmtCurrency(p.value, symbol)}</span>
          </div>
        ))}
      </div>
    )
  }
}

export function SpendChart({ dailySpend, platformBreakdown, loading, symbol }: Props) {
  const totalSpend = platformBreakdown.meta.spend + platformBreakdown.google.spend + platformBreakdown.linkedin.spend
  const hasMeta = platformBreakdown.meta.spend > 0
  const hasGoogle = platformBreakdown.google.spend > 0
  const hasLinkedIn = platformBreakdown.linkedin.spend > 0

  const chartData = dailySpend.map(d => ({
    date: fmtDate(d.date),
    Meta: parseFloat(d.meta.toFixed(2)),
    Google: parseFloat(d.google.toFixed(2)),
    LinkedIn: parseFloat((d.linkedin ?? 0).toFixed(2)),
  }))

  return (
    <div className="grid grid-cols-5 gap-3">
      {/* Platform breakdown — 2 cols */}
      <div className="col-span-2 bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
        <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-4">Spend by Platform</p>
        {loading ? (
          <div className="space-y-4">
            <SkeletonBlock h="h-8" />
            <SkeletonBlock h="h-8" />
          </div>
        ) : totalSpend === 0 ? (
          <p className="text-[#555] text-sm text-center py-6">No spend data</p>
        ) : (
          <div className="space-y-5">
            {hasMeta && <PlatformBar platform="meta" spend={platformBreakdown.meta.spend} total={totalSpend} color="#1877F2" symbol={symbol} />}
            {hasGoogle && <PlatformBar platform="google" spend={platformBreakdown.google.spend} total={totalSpend} color="#34A853" symbol={symbol} />}
            {hasLinkedIn && <PlatformBar platform="linkedin" spend={platformBreakdown.linkedin.spend} total={totalSpend} color="#0A66C2" symbol={symbol} />}
            <div className="pt-3 border-t border-[#1E1E1E] flex justify-between text-xs">
              <span className="text-[#555]">Total</span>
              <span className="text-white font-semibold">{fmtCurrency(totalSpend, symbol)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Spend over time — 3 cols */}
      <div className="col-span-3 bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
        <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-4">Spend Over Time</p>
        {loading ? (
          <SkeletonBlock h="h-48" />
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-[#555] text-sm">No daily data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#555', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#555', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => symbol + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)}
              />
              <Tooltip content={renderTooltip(symbol)} />
              <Legend
                wrapperStyle={{ fontSize: '11px', color: '#555' }}
                iconType="circle"
                iconSize={8}
              />
              {hasMeta && <Line type="monotone" dataKey="Meta" stroke="#1877F2" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />}
              {hasGoogle && <Line type="monotone" dataKey="Google" stroke="#34A853" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />}
              {hasLinkedIn && <Line type="monotone" dataKey="LinkedIn" stroke="#0A66C2" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

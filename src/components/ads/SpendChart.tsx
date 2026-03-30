'use client'

import { fmtCurrency } from '@/lib/currency'
import type { BreakdownBucket, BreakdownSeriesEntry } from '@/lib/ads-performance'
import { BrandIcon } from '@/components/shared/BrandIcon'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface DailyEntry { date: string; meta: number; google: number; linkedin: number }
interface PlatformBreakdown {
  meta: { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }
  google: { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }
  linkedin: { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}


function SkeletonBlock({ h = 'h-40' }: { h?: string }) {
  return <div className={`${h} bg-[#1A1A1A] rounded-lg animate-pulse`} />
}

function PlatformBar({
  platform,
  label,
  spend,
  total,
  color,
  symbol,
}: {
  platform: string
  label?: string
  spend: number
  total: number
  color: string
  symbol: string
}) {
  const pct = total > 0 ? (spend / total) * 100 : 0
  const labels: Record<string, string> = { meta: 'Meta Ads', google: 'Google Ads', linkedin: 'LinkedIn Ads' }
  const iconBrand = platform === 'google'
    ? 'adwords'
    : label === 'Facebook'
      ? 'facebook'
      : label === 'Instagram'
        ? 'instagram'
        : label === 'Messenger'
          ? 'messenger'
          : platform
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <BrandIcon brand={iconBrand} alt={label ?? labels[platform] ?? platform} size={20} background={platform === 'linkedin' ? 'white' : undefined} />
          <span className="text-[#A0A0A0] capitalize">{label ?? labels[platform] ?? platform}</span>
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
  detailBreakdown: BreakdownBucket[]
  detailDailySpend: BreakdownSeriesEntry[]
  loading: boolean
  symbol: string
  platformFilter: string
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

export function SpendChart({
  dailySpend,
  platformBreakdown,
  detailBreakdown,
  detailDailySpend,
  loading,
  symbol,
  platformFilter,
}: Props) {
  const totalSpend = platformBreakdown.meta.spend + platformBreakdown.google.spend + platformBreakdown.linkedin.spend
  const hasMeta = platformBreakdown.meta.spend > 0
  const hasGoogle = platformBreakdown.google.spend > 0
  const hasLinkedIn = platformBreakdown.linkedin.spend > 0
  const platformViewLabel = platformFilter === 'meta' ? 'Meta Ads' : platformFilter === 'google' ? 'Google Ads' : 'LinkedIn Ads'
  const filteredLabel = platformFilter === 'all' ? 'Spend by Platform' : `${platformViewLabel} Mix`

  const chartData = dailySpend.map(d => ({
    date: fmtDate(d.date),
    Meta: parseFloat(d.meta.toFixed(2)),
    Google: parseFloat(d.google.toFixed(2)),
    LinkedIn: parseFloat((d.linkedin ?? 0).toFixed(2)),
    Total: parseFloat((d.meta + d.google + (d.linkedin ?? 0)).toFixed(2)),
  }))
  const hasMetaSeries = chartData.some(row => row.Meta > 0)
  const hasGoogleSeries = chartData.some(row => row.Google > 0)
  const hasLinkedInSeries = chartData.some(row => row.LinkedIn > 0)
  const detailChartData = detailDailySpend.map(entry => {
    const row: Record<string, string | number> = { date: fmtDate(entry.date) }
    for (const bucket of detailBreakdown) {
      row[bucket.label] = parseFloat((entry.values[bucket.key] ?? 0).toFixed(2))
    }
    return row
  })
  const visibleDetailBreakdown = detailBreakdown
    .filter(item => item.spend > 0)
    .slice(0, platformFilter === 'linkedin' ? 5 : 6)
  const filteredTotal = visibleDetailBreakdown.reduce((sum, item) => sum + item.spend, 0)
  const fallbackSingleSeries = chartData.map(row => ({
    date: row.date,
    [platformViewLabel]: platformFilter === 'meta' ? row.Meta : platformFilter === 'google' ? row.Google : row.LinkedIn,
  }))
  const hasDetailSeries = detailChartData.length > 0 && visibleDetailBreakdown.length > 1

  return (
    <div className="grid grid-cols-5 gap-3">
      {/* Platform breakdown — 2 cols */}
      <div className="col-span-2 bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
        <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-4">{filteredLabel}</p>
        {loading ? (
          <div className="space-y-4">
            <SkeletonBlock h="h-8" />
            <SkeletonBlock h="h-8" />
          </div>
        ) : (platformFilter === 'all' ? totalSpend : filteredTotal) === 0 ? (
          <p className="text-[#555] text-sm text-center py-6">No spend data</p>
        ) : (
          <div className="space-y-5">
            {platformFilter === 'all' ? (
              <>
                {hasMeta && <PlatformBar platform="meta" label="Meta Ads" spend={platformBreakdown.meta.spend} total={totalSpend} color="#1877F2" symbol={symbol} />}
                {hasGoogle && <PlatformBar platform="google" label="Google Ads" spend={platformBreakdown.google.spend} total={totalSpend} color="#34A853" symbol={symbol} />}
                {hasLinkedIn && <PlatformBar platform="linkedin" label="LinkedIn Ads" spend={platformBreakdown.linkedin.spend} total={totalSpend} color="#00A0DC" symbol={symbol} />}
              </>
            ) : (
              <>
                {visibleDetailBreakdown.map(item => (
                  <PlatformBar
                    key={item.key}
                    platform={item.platform}
                    label={item.label}
                    spend={item.spend}
                    total={filteredTotal}
                    color={item.color ?? (platformFilter === 'meta' ? '#1877F2' : platformFilter === 'google' ? '#34A853' : '#00A0DC')}
                    symbol={symbol}
                  />
                ))}
              </>
            )}
            <div className="pt-3 border-t border-[#1E1E1E] flex justify-between text-xs">
              <span className="text-[#555]">{platformFilter === 'all' ? 'Total' : `${platformViewLabel} total`}</span>
              <span className="text-white font-semibold">{fmtCurrency(platformFilter === 'all' ? totalSpend : filteredTotal, symbol)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Spend over time — 3 cols */}
      <div className="col-span-3 bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
        <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-4">
          {platformFilter === 'all' ? 'Spend Over Time' : `${filteredLabel} Over Time`}
        </p>
        {loading ? (
          <SkeletonBlock h="h-48" />
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-[#555] text-sm">No daily data available</p>
          </div>
        ) : platformFilter === 'all' ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
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
              <Legend wrapperStyle={{ fontSize: '11px', color: '#555' }} iconType="circle" iconSize={8} />
              {hasMetaSeries && <Area type="monotone" dataKey="Meta" stackId="spend" stroke="#1877F2" fill="#1877F2" fillOpacity={0.28} />}
              {hasGoogleSeries && <Area type="monotone" dataKey="Google" stackId="spend" stroke="#34A853" fill="#34A853" fillOpacity={0.28} />}
              {hasLinkedInSeries && <Area type="monotone" dataKey="LinkedIn" stackId="spend" stroke="#00A0DC" fill="#00A0DC" fillOpacity={0.28} />}
            </AreaChart>
          </ResponsiveContainer>
        ) : hasDetailSeries ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={detailChartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
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
              <Legend wrapperStyle={{ fontSize: '11px', color: '#555' }} iconType="circle" iconSize={8} />
              {visibleDetailBreakdown.map(item => (
                <Area
                  key={item.key}
                  type="monotone"
                  dataKey={item.label}
                  stackId="spend"
                  stroke={item.color ?? '#1877F2'}
                  fill={item.color ?? '#1877F2'}
                  fillOpacity={0.26}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={fallbackSingleSeries} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
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
              <Line
                type="monotone"
                dataKey={platformViewLabel}
                name={platformViewLabel}
                stroke={platformFilter === 'meta' ? '#1877F2' : platformFilter === 'google' ? '#34A853' : '#00A0DC'}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

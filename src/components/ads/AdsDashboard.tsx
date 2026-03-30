'use client'

import { KPICards } from './KPICards'
import { SpendChart } from './SpendChart'
import { CampaignPerformance } from './CampaignPerformance'
import { AIInsights } from './AIInsights'
import { CreativePerformance } from './CreativePerformance'
import type { BreakdownBucket, BreakdownSeriesEntry, CampaignInsight, DailyEntry } from '@/lib/ads-performance'
import { currencySymbol } from '@/lib/currency'
import { BrandIcon } from '@/components/shared/BrandIcon'

export interface ConnectionError {
  code: string
  message: string
  platform: string
  settingsUrl: string
}

export interface InsightsData {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  roas: number | null
  ctr: number
  cpa: number | null
  dailySpend: DailyEntry[]
  campaigns: CampaignInsight[]
  platformBreakdown: {
    meta: { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }
    google: { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }
    linkedin: { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }
  }
  detailBreakdowns: {
    meta: BreakdownBucket[]
    google: BreakdownBucket[]
    linkedin: BreakdownBucket[]
  }
  detailDailySpend: {
    meta: BreakdownSeriesEntry[]
    google: BreakdownSeriesEntry[]
    linkedin: BreakdownSeriesEntry[]
  }
  previous: {
    spend: number
    impressions: number
    clicks: number
    conversions: number
    roas: number | null
  }
  errors: string[]
  connectionErrors: ConnectionError[]
  allPaused: boolean
  connected: { meta: boolean; google: boolean; linkedin: boolean }
  currency: string
}

const PLATFORM_COLORS: Record<string, string> = { meta: 'bg-blue-900/20 border-blue-900/30 text-blue-400', google: 'bg-green-900/20 border-green-900/30 text-green-400' }
const EMPTY_BREAKDOWN = {
  meta: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  google: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  linkedin: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
}

function ConnectionErrorBanner({ err }: { err: ConnectionError }) {
  const color = PLATFORM_COLORS[err.platform] ?? 'bg-yellow-900/20 border-yellow-900/30 text-yellow-400'
  const iconBrand = err.platform === 'google'
    ? 'adwords'
    : err.platform === 'searchConsole'
      ? 'google'
      : err.platform
  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center justify-between ${color}`}>
      <div className="flex items-center gap-3">
        <BrandIcon brand={iconBrand} alt={err.platform} size={18} background={err.platform === 'linkedin' ? 'white' : undefined} />
        <p className="text-sm">{err.message}</p>
      </div>
      <a href={err.settingsUrl} className="text-xs underline hover:no-underline shrink-0 ml-4">
        Connect →
      </a>
    </div>
  )
}

function NoPlatformsPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-4xl mb-4">📊</div>
      <h2 className="text-base font-semibold text-white mb-2">Connect your ad accounts</h2>
      <p className="text-sm text-[#555] max-w-sm mb-6">
        Connect Meta Ads or Google Ads to see your performance dashboard, spend analysis, and AI recommendations.
      </p>
      <a href="/settings" className="px-4 py-2 bg-[#DA7756] text-white text-sm font-medium rounded-lg hover:bg-[#DA7756]/90 transition-colors">
        Connect in Settings →
      </a>
    </div>
  )
}

interface Props {
  data: InsightsData | null
  loading: boolean
  platformFilter: string
  setPlatformFilter: (p: string) => void
}

export function AdsDashboard({ data, loading, platformFilter, setPlatformFilter }: Props) {
  // No ad platform connected — show full-page prompt
  if (!loading && data && !data.connected.meta && !data.connected.google && !data.connected.linkedin) {
    return <NoPlatformsPrompt />
  }

  const platformKey = platformFilter === 'all'
    ? null
    : (platformFilter as 'meta' | 'google' | 'linkedin')

  const filteredCampaigns = data?.campaigns
    ? (platformFilter === 'all' ? data.campaigns : data.campaigns.filter(c => c.platform === platformFilter))
    : []

  const derivedBreakdown = data
    ? (platformKey
        ? {
            ...EMPTY_BREAKDOWN,
            [platformKey]: data.platformBreakdown[platformKey],
          }
        : data.platformBreakdown)
    : EMPTY_BREAKDOWN

  const derivedDailySpend = data?.dailySpend
    ? data.dailySpend.map(entry => ({
        ...entry,
        meta: platformKey && platformKey !== 'meta' ? 0 : entry.meta,
        google: platformKey && platformKey !== 'google' ? 0 : entry.google,
        linkedin: platformKey && platformKey !== 'linkedin' ? 0 : entry.linkedin,
      }))
    : []

  const derivedSummary = (() => {
    if (!data) return null

    if (!platformKey) {
      return {
        spend: data.spend,
        impressions: data.impressions,
        clicks: data.clicks,
        conversions: data.conversions,
        revenue: data.revenue,
        roas: data.roas,
        ctr: data.ctr,
        cpa: data.cpa,
        cpc: data.clicks > 0 ? data.spend / data.clicks : null,
        activeCampaigns: data.campaigns.filter(c => c.status !== 'PAUSED').length,
        campaignCount: data.campaigns.length,
        previous: data.previous,
      }
    }

    if (platformKey === 'linkedin') {
      const linkedIn = data.platformBreakdown.linkedin
      return {
        spend: linkedIn.spend,
        impressions: linkedIn.impressions,
        clicks: linkedIn.clicks,
        conversions: linkedIn.conversions,
        revenue: linkedIn.revenue,
        roas: linkedIn.spend > 0 && linkedIn.revenue > 0 ? linkedIn.revenue / linkedIn.spend : null,
        ctr: linkedIn.impressions > 0 ? (linkedIn.clicks / linkedIn.impressions) * 100 : 0,
        cpa: linkedIn.conversions > 0 ? linkedIn.spend / linkedIn.conversions : null,
        cpc: linkedIn.clicks > 0 ? linkedIn.spend / linkedIn.clicks : null,
        activeCampaigns: filteredCampaigns.filter(c => c.status !== 'PAUSED').length,
        campaignCount: filteredCampaigns.length,
        previous: { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: null },
      }
    }

    const spend = filteredCampaigns.reduce((sum, c) => sum + c.spend, 0)
    const impressions = filteredCampaigns.reduce((sum, c) => sum + c.impressions, 0)
    const clicks = filteredCampaigns.reduce((sum, c) => sum + c.clicks, 0)
    const conversions = filteredCampaigns.reduce((sum, c) => sum + c.conversions, 0)
    const revenue = filteredCampaigns.reduce((sum, c) => sum + c.revenue, 0)

    return {
      spend,
      impressions,
      clicks,
      conversions,
      revenue,
      roas: spend > 0 && revenue > 0 ? revenue / spend : null,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpa: conversions > 0 ? spend / conversions : null,
      cpc: clicks > 0 ? spend / clicks : null,
      activeCampaigns: filteredCampaigns.filter(c => c.status !== 'PAUSED').length,
      campaignCount: filteredCampaigns.length,
      previous: { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: null },
    }
  })()

  const topSummaryLabel = platformKey
    ? `${platformKey === 'meta' ? 'Meta' : platformKey === 'google' ? 'Google' : 'LinkedIn'} view`
    : 'Cross-platform view'
  const derivedDetailBreakdown = platformKey
    ? data?.detailBreakdowns[platformKey] ?? []
    : []
  const derivedDetailDaily = platformKey
    ? data?.detailDailySpend[platformKey] ?? []
    : []

  const symbol = currencySymbol(data?.currency ?? 'INR')

  return (
    <div className="p-5 space-y-4">
      {/* All paused banner */}
      {data?.allPaused && (
        <div className="bg-yellow-900/10 border border-yellow-900/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-yellow-400 text-sm">⚠</span>
          <p className="text-sm text-yellow-400">
            All campaigns are paused. Activate campaigns to see live performance data.
          </p>
        </div>
      )}

      {/* Platform connection errors — show actionable banners */}
      {data?.connectionErrors?.map((e, i) => <ConnectionErrorBanner key={i} err={e} />)}

      {/* API errors */}
      {data?.errors?.map((e, i) => {
        const isDevTokenIssue = e.includes('UNIMPLEMENTED') || e.includes('DEVELOPER_TOKEN')
        return (
          <div key={i} className="bg-red-900/10 border border-red-900/30 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-red-400 text-sm shrink-0 mt-0.5">⚠</span>
            <div>
              {isDevTokenIssue ? (
                <>
                  <p className="text-sm text-red-400 font-medium">Google Ads developer token needs Standard Access</p>
                  <p className="text-xs text-red-400/70 mt-0.5">
                    Your Google Ads API developer token is in Test mode and cannot access real accounts.
                    Go to <span className="font-mono">Google Ads → Tools & Settings → API Center</span> and apply for Basic/Standard Access.
                  </p>
                </>
              ) : (
                <p className="text-sm text-red-400">{e}</p>
              )}
            </div>
          </div>
        )
      })}

      {/* Platform filter */}
      <div className="flex items-center gap-1">
        {[
          { key: 'all', label: 'All Platforms' },
          { key: 'meta', label: 'Meta Ads' },
          { key: 'google', label: 'Google Ads' },
          { key: 'linkedin', label: 'LinkedIn Ads' },
        ].map(p => (
          <button
            key={p.key}
            onClick={() => setPlatformFilter(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              platformFilter === p.key
                ? 'bg-[#DA7756]/10 text-[#DA7756] border border-[#DA7756]/30'
                : 'text-[#555] hover:text-[#A0A0A0] border border-transparent'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-[#555] px-1">
        <span>{topSummaryLabel}</span>
        <span>
          {platformKey
            ? `${filteredCampaigns.length} campaign${filteredCampaigns.length === 1 ? '' : 's'} in current filter`
            : `${data?.campaigns.length ?? 0} campaigns across connected platforms`}
        </span>
      </div>

      {/* Row 1: KPI Cards */}
      <KPICards data={derivedSummary} loading={loading} symbol={symbol} platformFilter={platformFilter} />

      {/* Row 2: Spend by Platform + Spend Over Time */}
      <SpendChart
        dailySpend={derivedDailySpend}
        platformBreakdown={derivedBreakdown}
        detailBreakdown={derivedDetailBreakdown}
        detailDailySpend={derivedDetailDaily}
        loading={loading}
        symbol={symbol}
        platformFilter={platformFilter}
      />

      {/* Row 3: Best vs Worst */}
      <CampaignPerformance campaigns={filteredCampaigns} loading={loading} platformFilter={platformFilter} symbol={symbol} />

      {/* Row 4: AI Insights */}
      <AIInsights
        campaigns={filteredCampaigns}
        spend={derivedSummary?.spend ?? 0}
        roas={derivedSummary?.roas ?? null}
        symbol={symbol}
      />

      {/* Row 5: Creative Performance */}
      <CreativePerformance campaigns={filteredCampaigns} loading={loading} platformFilter={platformFilter} symbol={symbol} />
    </div>
  )
}

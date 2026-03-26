'use client'

import { KPICards } from './KPICards'
import { SpendChart } from './SpendChart'
import { CampaignPerformance } from './CampaignPerformance'
import { AIInsights } from './AIInsights'
import { CreativePerformance } from './CreativePerformance'
import type { CampaignInsight, DailyEntry } from '@/lib/ads-performance'
import { currencySymbol } from '@/lib/currency'

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
    meta: { spend: number; impressions: number }
    google: { spend: number; impressions: number }
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
  connected: { meta: boolean; google: boolean }
  currency: string
}

const PLATFORM_ICONS: Record<string, string> = { meta: '𝕄', google: 'G', searchConsole: 'SC', linkedin: 'in', facebook: 'f', unknown: '?' }
const PLATFORM_COLORS: Record<string, string> = { meta: 'bg-blue-900/20 border-blue-900/30 text-blue-400', google: 'bg-green-900/20 border-green-900/30 text-green-400' }

function ConnectionErrorBanner({ err }: { err: ConnectionError }) {
  const color = PLATFORM_COLORS[err.platform] ?? 'bg-yellow-900/20 border-yellow-900/30 text-yellow-400'
  const icon = PLATFORM_ICONS[err.platform] ?? '?'
  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center justify-between ${color}`}>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold">{icon}</span>
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
  // Neither platform connected — show full-page prompt
  if (!loading && data && !data.connected.meta && !data.connected.google) {
    return <NoPlatformsPrompt />
  }

  const filteredCampaigns = data?.campaigns
    ? (platformFilter === 'all' ? data.campaigns : data.campaigns.filter(c => c.platform === platformFilter))
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
        {['all', 'meta', 'google'].map(p => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              platformFilter === p
                ? 'bg-[#DA7756]/10 text-[#DA7756] border border-[#DA7756]/30'
                : 'text-[#555] hover:text-[#A0A0A0] border border-transparent'
            }`}
          >
            {p === 'all' ? 'All Platforms' : p === 'meta' ? 'Meta Ads' : 'Google Ads'}
          </button>
        ))}
      </div>

      {/* Row 1: KPI Cards */}
      <KPICards data={data} loading={loading} symbol={symbol} />

      {/* Row 2: Spend by Platform + Spend Over Time */}
      <SpendChart
        dailySpend={data?.dailySpend ?? []}
        platformBreakdown={data?.platformBreakdown ?? { meta: { spend: 0, impressions: 0 }, google: { spend: 0, impressions: 0 } }}
        loading={loading}
        symbol={symbol}
      />

      {/* Row 3: Best vs Worst */}
      <CampaignPerformance campaigns={filteredCampaigns} loading={loading} platformFilter={platformFilter} symbol={symbol} />

      {/* Row 4: AI Insights */}
      <AIInsights
        campaigns={filteredCampaigns}
        spend={data?.spend ?? 0}
        roas={data?.roas ?? null}
        symbol={symbol}
      />

      {/* Row 5: Creative Performance */}
      <CreativePerformance campaigns={filteredCampaigns} loading={loading} platformFilter={platformFilter} symbol={symbol} />
    </div>
  )
}

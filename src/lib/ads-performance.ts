import axios from 'axios'
import mongoose from 'mongoose'
import Brand from '@/models/Brand'
import User from '@/models/User'
import { connectDB } from '@/lib/mongodb'
import { getValidGoogleToken } from '@/lib/google-auth'
import { makeConnectionError, parseMetaApiError, type ConnectionError } from '@/lib/get-user-connections'

export interface CampaignInsight {
  id: string
  name: string
  platform: 'meta' | 'google' | 'linkedin'
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

export interface DailyEntry {
  date: string
  meta: number
  google: number
  linkedin: number
}

export interface BreakdownBucket {
  key: string
  label: string
  platform: 'meta' | 'google' | 'linkedin'
  spend: number
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  color?: string
}

export interface BreakdownSeriesEntry {
  date: string
  values: Record<string, number>
}

export interface AdsInsightsPayload {
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
  previous: { spend: number; impressions: number; clicks: number; conversions: number; roas: number | null }
  errors: string[]
  connectionErrors: ConnectionError[]
  allPaused: boolean
  connected: { meta: boolean; google: boolean; linkedin: boolean }
  currency: string
}

type UserConnections = {
  meta?: { accessToken?: string; accountId?: string; accountName?: string }
  google?: { customerId?: string }
  linkedin?: { accessToken?: string; adAccountId?: string; adAccountName?: string }
}

function fmt(d: Date) {
  return d.toISOString().split('T')[0]
}

function encodeRestliList(...values: string[]) {
  return `List(${values.map(value => encodeURIComponent(value)).join(',')})`
}

function buildLinkedInStatisticsUrl(params: {
  dateRange: string
  timeGranularity: 'ALL' | 'DAILY'
  accountUrn: string
}) {
  const pivots = encodeRestliList('ACCOUNT')
  const accounts = encodeRestliList(params.accountUrn)
  const fields = [
    'impressions',
    'clicks',
    'costInLocalCurrency',
    'externalWebsiteConversions',
    'oneClickLeads',
  ].join(',')

  return `https://api.linkedin.com/rest/adAnalytics?q=statistics&dateRange=${params.dateRange}&timeGranularity=${params.timeGranularity}&accounts=${accounts}&pivots=${pivots}&fields=${fields}`
}

function buildLinkedInCampaignAnalyticsUrl(params: {
  dateRange: string
  accountUrn: string
  timeGranularity?: 'ALL' | 'DAILY'
}) {
  const accounts = encodeRestliList(params.accountUrn)
  const fields = [
    'pivotValues',
    'dateRange',
    'impressions',
    'clicks',
    'costInLocalCurrency',
    'externalWebsiteConversions',
    'oneClickLeads',
  ].join(',')

  return `https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=CAMPAIGN&timeGranularity=${params.timeGranularity ?? 'ALL'}&dateRange=${params.dateRange}&accounts=${accounts}&fields=${fields}`
}

function buildRange(days: number, offsetDays = 0) {
  const until = new Date()
  until.setDate(until.getDate() - 1 - offsetDays)
  const since = new Date(until)
  since.setDate(since.getDate() - days + 1)
  return { since: fmt(since), until: fmt(until) }
}

function pickActions(arr: Array<{ action_type: string; value: string }> | undefined, types: string[]): number {
  return (arr ?? [])
    .filter(a => types.includes(a.action_type))
    .reduce((sum, a) => sum + parseFloat(a.value ?? '0'), 0)
}

function flattenGoogleResults(data: unknown) {
  if (Array.isArray(data)) {
    return data.flatMap(item => Array.isArray((item as { results?: unknown[] }).results) ? (item as { results: unknown[] }).results : [])
  }
  if (Array.isArray((data as { results?: unknown[] } | null)?.results)) {
    return (data as { results: unknown[] }).results
  }
  return []
}

const META_CHANNEL_META: Record<string, { label: string; color: string }> = {
  facebook: { label: 'Facebook', color: '#1877F2' },
  instagram: { label: 'Instagram', color: '#E4405F' },
  messenger: { label: 'Messenger', color: '#00B2FF' },
  audience_network: { label: 'Audience Network', color: '#6B46C1' },
  threads: { label: 'Threads', color: '#111111' },
}

function googleNetworkLabel(value: string) {
  const labels: Record<string, string> = {
    SEARCH: 'Search',
    SEARCH_PARTNERS: 'Search Partners',
    DISPLAY: 'Display',
    CONTENT: 'Display',
    YOUTUBE_SEARCH: 'YouTube Search',
    YOUTUBE_WATCH: 'YouTube Watch',
    YOUTUBE: 'YouTube',
    DISCOVER: 'Discover',
    GMAIL: 'Gmail',
    MAPS: 'Maps',
    MIXED: 'Mixed',
    UNSPECIFIED: 'Unspecified',
    UNKNOWN: 'Unknown',
  }
  return labels[value] ?? value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function googleNetworkColor(value: string) {
  const colors: Record<string, string> = {
    SEARCH: '#34A853',
    SEARCH_PARTNERS: '#5BB974',
    DISPLAY: '#4285F4',
    CONTENT: '#4285F4',
    YOUTUBE_SEARCH: '#EA4335',
    YOUTUBE_WATCH: '#FF6D01',
    YOUTUBE: '#EA4335',
    DISCOVER: '#A142F4',
    GMAIL: '#FBBC05',
    MAPS: '#0F9D58',
    MIXED: '#9AA0A6',
  }
  return colors[value] ?? '#34A853'
}

function upsertBucket(
  map: Map<string, BreakdownBucket>,
  input: Omit<BreakdownBucket, 'spend' | 'impressions' | 'clicks' | 'conversions' | 'revenue'> & {
    spend?: number
    impressions?: number
    clicks?: number
    conversions?: number
    revenue?: number
  }
) {
  const current = map.get(input.key) ?? {
    key: input.key,
    label: input.label,
    platform: input.platform,
    color: input.color,
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
  }
  current.spend += input.spend ?? 0
  current.impressions += input.impressions ?? 0
  current.clicks += input.clicks ?? 0
  current.conversions += input.conversions ?? 0
  current.revenue += input.revenue ?? 0
  map.set(input.key, current)
}

function addSeriesValue(
  map: Map<string, Record<string, number>>,
  date: string,
  key: string,
  value: number,
) {
  const row = map.get(date) ?? {}
  row[key] = (row[key] ?? 0) + value
  map.set(date, row)
}

function finalizeSeries(map: Map<string, Record<string, number>>): BreakdownSeriesEntry[] {
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({ date, values }))
}

async function runGoogleAdsQuery(params: {
  customerId: string
  token: string
  developerToken: string
  query: string
}) {
  const cid = params.customerId.replace(/-/g, '')
  const headers = {
    Authorization: `Bearer ${params.token}`,
    'developer-token': params.developerToken,
    'Content-Type': 'application/json',
  }

  const attempts = [
    `https://googleads.googleapis.com/v22/customers/${cid}/googleAds:searchStream`,
    `https://googleads.googleapis.com/v22/customers/${cid}/googleAds:search`,
    `https://googleads.googleapis.com/v19/customers/${cid}/googleAds:searchStream`,
    `https://googleads.googleapis.com/v19/customers/${cid}/googleAds:search`,
  ]

  let lastError: unknown
  for (const endpoint of attempts) {
    try {
      const response = await axios.post(endpoint, { query: params.query.trim() }, { headers })
      return flattenGoogleResults(response.data)
    } catch (error) {
      lastError = error
      const status = (error as { response?: { status?: number } }).response?.status
      if (status && ![404, 400].includes(status)) {
        break
      }
    }
  }

  throw lastError
}

export async function getAdsInsightsForUser(params: {
  userId: string
  days?: number
  since?: string
  until?: string
}): Promise<AdsInsightsPayload> {
  await connectDB()

  const [brand, user] = await Promise.all([
    Brand.findOne({ userId: params.userId }).lean() as Promise<{ currency?: string } | null>,
    User.findById(params.userId).select('connections').lean() as Promise<{ connections?: UserConnections } | null>,
  ])

  const currency = brand?.currency ?? 'INR'
  const days = params.days ?? 30
  const curr = params.since && params.until ? { since: params.since, until: params.until } : buildRange(days)
  const actualDays = params.since && params.until
    ? Math.ceil((new Date(params.until).getTime() - new Date(params.since).getTime()) / 86400000) + 1
    : days
  const prev = buildRange(actualDays, actualDays)

  const errors: string[] = []
  const connectionErrors: ConnectionError[] = []
  const campaigns: CampaignInsight[] = []
  const dailyMap = new Map<string, DailyEntry>()
  const metaBreakdownMap = new Map<string, BreakdownBucket>()
  const metaDetailDailyMap = new Map<string, Record<string, number>>()
  const googleBreakdownMap = new Map<string, BreakdownBucket>()
  const googleDetailDailyMap = new Map<string, Record<string, number>>()
  const linkedinBreakdownMap = new Map<string, BreakdownBucket>()
  const linkedinDetailDailyMap = new Map<string, Record<string, number>>()
  const linkedinCampaignDailyTotalsMap = new Map<string, number>()
  let prevSpend = 0
  let prevImpr = 0
  let prevClicks = 0
  let prevConv = 0
  let prevRev = 0

  const meta = user?.connections?.meta
  const google = user?.connections?.google
  const linkedin = user?.connections?.linkedin
  const convTypes = ['purchase', 'omni_purchase', 'complete_registration', 'lead']
  const revTypes = ['purchase', 'omni_purchase']

  if (!meta?.accessToken) {
    connectionErrors.push(makeConnectionError('META_NOT_CONNECTED'))
  } else if (!meta.accountId) {
    connectionErrors.push(makeConnectionError('META_ACCOUNT_NOT_SELECTED'))
  } else {
    try {
      const accountId = String(meta.accountId).replace(/^act_/, '')
      const fields = [
        'spend', 'impressions', 'clicks', 'ctr', 'reach',
        'actions', 'action_values', 'purchase_roas',
        'campaign_id', 'campaign_name',
      ].join(',')

      const timeRange = JSON.stringify({ since: curr.since, until: curr.until })
      const prevTimeRange = JSON.stringify({ since: prev.since, until: prev.until })

      const [insRes, prevRes, campRes, breakdownRes] = await Promise.all([
        axios.get(`https://graph.facebook.com/v21.0/act_${accountId}/insights`, {
          params: { access_token: meta.accessToken, fields, level: 'campaign', time_increment: 1, time_range: timeRange, limit: 1000 },
        }),
        axios.get(`https://graph.facebook.com/v21.0/act_${accountId}/insights`, {
          params: { access_token: meta.accessToken, fields: 'spend,impressions,clicks,actions,action_values', time_range: prevTimeRange, limit: 1 },
        }),
        axios.get(`https://graph.facebook.com/v21.0/act_${accountId}/campaigns`, {
          params: { access_token: meta.accessToken, fields: 'id,name,status', limit: 200 },
        }),
        axios.get(`https://graph.facebook.com/v21.0/act_${accountId}/insights`, {
          params: {
            access_token: meta.accessToken,
            fields: 'spend,impressions,clicks,actions,action_values,date_start',
            level: 'campaign',
            time_increment: 1,
            breakdowns: 'publisher_platform',
            time_range: timeRange,
            limit: 1000,
          },
        }),
      ])

      const statusMap = new Map<string, string>()
      for (const c of (campRes.data.data ?? [])) statusMap.set(c.id, c.status)

      const aggMap = new Map<string, CampaignInsight>()
      for (const row of (insRes.data.data ?? [])) {
        const date = row.date_start as string
        const spend = parseFloat(row.spend ?? '0')
        const entry = dailyMap.get(date) ?? { date, meta: 0, google: 0, linkedin: 0 }
        entry.meta += spend
        dailyMap.set(date, entry)

        const cid = row.campaign_id as string
        const agg = aggMap.get(cid) ?? {
          id: cid,
          name: row.campaign_name as string,
          platform: 'meta' as const,
          status: statusMap.get(cid) ?? 'UNKNOWN',
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
          roas: null,
          ctr: 0,
          cpa: null,
        }
        agg.spend += spend
        agg.impressions += parseInt(row.impressions ?? '0')
        agg.clicks += parseInt(row.clicks ?? '0')
        agg.conversions += pickActions(row.actions, convTypes)
        agg.revenue += pickActions(row.action_values, revTypes)
        aggMap.set(cid, agg)
      }

      for (const [, campaign] of aggMap) {
        campaign.ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0
        campaign.roas = campaign.spend > 0 && campaign.revenue > 0 ? campaign.revenue / campaign.spend : null
        campaign.cpa = campaign.conversions > 0 ? campaign.spend / campaign.conversions : null
        campaigns.push(campaign)
      }

      for (const row of (breakdownRes.data.data ?? [])) {
        const key = String(row.publisher_platform ?? 'unknown')
        const metaChannel = META_CHANNEL_META[key] ?? {
          label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          color: '#1877F2',
        }
        const date = row.date_start as string
        const spend = parseFloat(row.spend ?? '0')
        const impressions = parseInt(row.impressions ?? '0')
        const clicks = parseInt(row.clicks ?? '0')
        const conversions = pickActions(row.actions, convTypes)
        const revenue = pickActions(row.action_values, revTypes)

        upsertBucket(metaBreakdownMap, {
          key,
          label: metaChannel.label,
          platform: 'meta',
          color: metaChannel.color,
          spend,
          impressions,
          clicks,
          conversions,
          revenue,
        })
        addSeriesValue(metaDetailDailyMap, date, key, spend)
      }

      const previousData = prevRes.data.data?.[0]
      if (previousData) {
        prevSpend += parseFloat(previousData.spend ?? '0')
        prevImpr += parseInt(previousData.impressions ?? '0')
        prevClicks += parseInt(previousData.clicks ?? '0')
        prevConv += pickActions(previousData.actions, convTypes)
        prevRev += pickActions(previousData.action_values, revTypes)
      }
    } catch (error) {
      const parsed = parseMetaApiError(error)
      if (parsed) {
        connectionErrors.push({ ...makeConnectionError(parsed.code), message: `Meta Ads: ${parsed.detail} — reconnect in Settings` })
      } else {
        errors.push('Meta Ads insights failed — check your connection in Settings')
      }
    }
  }

  if (!google?.customerId) {
    connectionErrors.push(makeConnectionError('GOOGLE_NOT_CONNECTED'))
  } else {
    try {
      const token = await getValidGoogleToken(params.userId, 'google')
      if (!token) throw new Error('No Google token')
      const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN
      if (!developerToken) throw new Error('No Google Ads developer token')

      const query = `
        SELECT campaign.id, campaign.name, campaign.status,
               metrics.cost_micros, metrics.impressions, metrics.clicks,
               metrics.conversions, metrics.conversion_value, metrics.ctr,
               segments.date, segments.ad_network_type
        FROM campaign
        WHERE segments.date BETWEEN '${curr.since}' AND '${curr.until}'
          AND campaign.status != 'REMOVED'
        ORDER BY segments.date
      `
      const prevQuery = `
        SELECT metrics.cost_micros, metrics.impressions, metrics.clicks,
               metrics.conversions, metrics.conversion_value
        FROM campaign
        WHERE segments.date BETWEEN '${prev.since}' AND '${prev.until}'
          AND campaign.status != 'REMOVED'
      `

      const [results, previousResults] = await Promise.all([
        runGoogleAdsQuery({ customerId: google.customerId, token, developerToken, query }),
        runGoogleAdsQuery({ customerId: google.customerId, token, developerToken, query: prevQuery }),
      ])

      const aggMap = new Map<string, CampaignInsight>()
      for (const row of results as Array<{
        campaign?: { id?: string | number; name?: string; status?: string }
        metrics?: { costMicros?: string | number; impressions?: string | number; clicks?: string | number; conversions?: string | number; conversionValue?: string | number }
        segments?: { date?: string; adNetworkType?: string }
      }>) {
        const date = row.segments?.date || curr.until
        const spend = Number(row.metrics?.costMicros || 0) / 1_000_000
        const entry = dailyMap.get(date) ?? { date, meta: 0, google: 0, linkedin: 0 }
        entry.google += spend
        dailyMap.set(date, entry)
        const networkKey = String(row.segments?.adNetworkType || 'UNKNOWN')
        upsertBucket(googleBreakdownMap, {
          key: networkKey,
          label: googleNetworkLabel(networkKey),
          platform: 'google',
          color: googleNetworkColor(networkKey),
          spend,
          impressions: Number(row.metrics?.impressions || 0),
          clicks: Number(row.metrics?.clicks || 0),
          conversions: Number(row.metrics?.conversions || 0),
          revenue: Number(row.metrics?.conversionValue || 0),
        })
        addSeriesValue(googleDetailDailyMap, date, networkKey, spend)

        const gid = String(row.campaign?.id || '')
        const agg = aggMap.get(gid) ?? {
          id: gid,
          name: row.campaign?.name || 'Unknown',
          platform: 'google' as const,
          status: row.campaign?.status || 'UNKNOWN',
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
          roas: null,
          ctr: 0,
          cpa: null,
        }
        agg.spend += spend
        agg.impressions += Number(row.metrics?.impressions || 0)
        agg.clicks += Number(row.metrics?.clicks || 0)
        agg.conversions += Number(row.metrics?.conversions || 0)
        agg.revenue += Number(row.metrics?.conversionValue || 0)
        aggMap.set(gid, agg)
      }

      for (const [, campaign] of aggMap) {
        campaign.ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0
        campaign.roas = campaign.spend > 0 && campaign.revenue > 0 ? campaign.revenue / campaign.spend : null
        campaign.cpa = campaign.conversions > 0 ? campaign.spend / campaign.conversions : null
        campaigns.push(campaign)
      }

      for (const row of previousResults as Array<{
        metrics?: { costMicros?: string | number; impressions?: string | number; clicks?: string | number; conversions?: string | number; conversionValue?: string | number }
      }>) {
        prevSpend += Number(row.metrics?.costMicros || 0) / 1_000_000
        prevImpr += Number(row.metrics?.impressions || 0)
        prevClicks += Number(row.metrics?.clicks || 0)
        prevConv += Number(row.metrics?.conversions || 0)
        prevRev += Number(row.metrics?.conversionValue || 0)
      }
    } catch (error) {
      const err = error as { response?: { data?: unknown }; message?: string }
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message || 'Unknown Google Ads error'
      errors.push(`Google Ads insights failed: ${detail.slice(0, 200)}`)
    }
  }

  // ─── LinkedIn Ads ──────────────────────────────────────────────────────────
  // Account-level totals only (pivot=ACCOUNT) — campaign-level breakdown requires
  // specifying campaign IDs which we don't have at query time.
  // LinkedIn spend/impressions/clicks appear in KPI cards, spend chart, and
  // platform breakdown. Campaign names come from the /api/ads/campaigns route.
  let liSpend = 0, liImpr = 0, liClicks = 0, liConv = 0

  if (linkedin?.accessToken && linkedin.adAccountId) {
    try {
      const liHeaders = {
        Authorization: `Bearer ${linkedin.accessToken}`,
        'LinkedIn-Version': '202504',
        'X-Restli-Protocol-Version': '2.0.0',
      }
      const accountUrn = `urn:li:sponsoredAccount:${linkedin.adAccountId}`
      const [sy, sm, sd] = curr.since.split('-').map(Number)
      const [ey, em, ed] = curr.until.split('-').map(Number)
      const [psy, psm, psd] = prev.since.split('-').map(Number)
      const [pey, pem, ped] = prev.until.split('-').map(Number)
      // Restli compound format — parentheses/colons sent raw (NOT percent-encoded)
      const dr = `(start:(year:${sy},month:${sm},day:${sd}),end:(year:${ey},month:${em},day:${ed}))`
      const drPrev = `(start:(year:${psy},month:${psm},day:${psd}),end:(year:${pey},month:${pem},day:${ped}))`
      const totalsUrl = buildLinkedInStatisticsUrl({
        dateRange: dr,
        timeGranularity: 'ALL',
        accountUrn,
      })
      const dailyUrl = buildLinkedInStatisticsUrl({
        dateRange: dr,
        timeGranularity: 'DAILY',
        accountUrn,
      })
      const prevUrl = buildLinkedInStatisticsUrl({
        dateRange: drPrev,
        timeGranularity: 'ALL',
        accountUrn,
      })
      console.log('[linkedin ads] totalsUrl:', totalsUrl)

      const campaignsRes = await axios.get(
        `https://api.linkedin.com/rest/adAccounts/${linkedin.adAccountId}/adCampaigns?q=search&pageSize=100`,
        { headers: liHeaders }
      )
      const liCampaignCatalog = new Map<string, { name: string; status: string }>()
      for (const campaign of (campaignsRes.data?.elements ?? []) as Array<{ id?: number; name?: string; status?: string }>) {
        if (campaign.id == null) continue
        liCampaignCatalog.set(String(campaign.id), {
          name: campaign.name ?? 'Unknown',
          status: campaign.status ?? 'UNKNOWN',
        })
      }

      const [totalsRes, dailyRes, prevRes, campaignStatsRes, campaignStatsDailyRes] = await Promise.all([
        axios.get(totalsUrl, { headers: liHeaders }),
        axios.get(dailyUrl,  { headers: liHeaders }),
        axios.get(prevUrl,   { headers: liHeaders }),
        axios.get(buildLinkedInCampaignAnalyticsUrl({ dateRange: dr, accountUrn, timeGranularity: 'ALL' }), { headers: liHeaders }),
        axios.get(buildLinkedInCampaignAnalyticsUrl({ dateRange: dr, accountUrn, timeGranularity: 'DAILY' }), { headers: liHeaders }),
      ])

      // Log first element keys so we can verify actual field names
      if (totalsRes.data?.elements?.[0]) {
        console.log('[linkedin ads] sample element keys:', Object.keys(totalsRes.data.elements[0]))
      }

      // Account-level totals
      const totData = totalsRes.data?.elements?.[0]
      if (totData) {
        liSpend  = parseFloat(totData.costInLocalCurrency ?? '0')
        liImpr   = Number(totData.impressions ?? 0)
        liClicks = Number(totData.clicks ?? 0)
        liConv   = Number(totData.externalWebsiteConversions ?? totData.oneClickLeads ?? 0)
      }

      // Daily spend breakdown for chart
      for (const row of (dailyRes.data?.elements ?? [])) {
        const dr2 = row.dateRange?.start as { year?: number; month?: number; day?: number } | undefined
        if (!dr2?.year) continue
        const date = `${dr2.year}-${String(dr2.month ?? 1).padStart(2, '0')}-${String(dr2.day ?? 1).padStart(2, '0')}`
        const spend = parseFloat(row.costInLocalCurrency ?? '0')
        const entry = dailyMap.get(date) ?? { date, meta: 0, google: 0, linkedin: 0 }
        entry.linkedin += spend
        dailyMap.set(date, entry)
      }

      // Previous period totals
      const prevData = prevRes.data?.elements?.[0]
      if (prevData) {
        prevSpend  += parseFloat(prevData.costInLocalCurrency ?? '0')
        prevImpr   += Number(prevData.impressions ?? 0)
        prevClicks += Number(prevData.clicks ?? 0)
        prevConv   += Number(prevData.externalWebsiteConversions ?? prevData.oneClickLeads ?? 0)
      }

      for (const row of (campaignStatsRes.data?.elements ?? []) as Array<{
        pivotValues?: string[]
        impressions?: number | string
        clicks?: number | string
        costInLocalCurrency?: string
        externalWebsiteConversions?: number | string
        oneClickLeads?: number | string
      }>) {
        const urn = row.pivotValues?.[0]
        if (!urn) continue
        const campaignId = urn.split(':').pop() ?? urn
        const catalog = liCampaignCatalog.get(campaignId)
        const spend = parseFloat(row.costInLocalCurrency ?? '0')
        const impressions = Number(row.impressions ?? 0)
        const clicks = Number(row.clicks ?? 0)
        const conversions = Number(row.externalWebsiteConversions ?? row.oneClickLeads ?? 0)

        campaigns.push({
          id: campaignId,
          name: catalog?.name ?? `LinkedIn Campaign ${campaignId}`,
          platform: 'linkedin',
          status: catalog?.status ?? 'UNKNOWN',
          spend,
          impressions,
          clicks,
          conversions,
          revenue: 0,
          roas: null,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpa: conversions > 0 ? spend / conversions : null,
        })

        upsertBucket(linkedinBreakdownMap, {
          key: campaignId,
          label: catalog?.name ?? `Campaign ${campaignId}`,
          platform: 'linkedin',
          color: '#0A66C2',
          spend,
          impressions,
          clicks,
          conversions,
          revenue: 0,
        })
      }

      for (const row of (campaignStatsDailyRes.data?.elements ?? []) as Array<{
        pivotValues?: string[]
        dateRange?: { start?: { year?: number; month?: number; day?: number } }
        costInLocalCurrency?: string
      }>) {
        const urn = row.pivotValues?.[0]
        const start = row.dateRange?.start
        if (!urn || !start?.year) continue
        const campaignId = urn.split(':').pop() ?? urn
        const spend = parseFloat(row.costInLocalCurrency ?? '0')
        if (spend <= 0) continue

        const date = `${start.year}-${String(start.month ?? 1).padStart(2, '0')}-${String(start.day ?? 1).padStart(2, '0')}`
        addSeriesValue(linkedinDetailDailyMap, date, campaignId, spend)
        linkedinCampaignDailyTotalsMap.set(date, (linkedinCampaignDailyTotalsMap.get(date) ?? 0) + spend)
      }

      for (const [date, spend] of linkedinCampaignDailyTotalsMap.entries()) {
        const entry = dailyMap.get(date) ?? { date, meta: 0, google: 0, linkedin: 0 }
        entry.linkedin = spend
        dailyMap.set(date, entry)
      }
    } catch (error) {
      const err = error as { response?: { data?: unknown; status?: number }; message?: string }
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message || 'Unknown error'
      console.error('[linkedin ads] fetch failed:', detail)
      errors.push(`LinkedIn Ads insights failed: ${detail.slice(0, 200)}`)
    }
  }

  const metaCampaigns    = campaigns.filter(item => item.platform === 'meta')
  const googleCampaigns  = campaigns.filter(item => item.platform === 'google')
  const linkedinCampaigns = campaigns.filter(item => item.platform === 'linkedin')
  const summarize = (items: CampaignInsight[]) => ({
    spend: items.reduce((sum, item) => sum + item.spend, 0),
    impressions: items.reduce((sum, item) => sum + item.impressions, 0),
    clicks: items.reduce((sum, item) => sum + item.clicks, 0),
    conversions: items.reduce((sum, item) => sum + item.conversions, 0),
    revenue: items.reduce((sum, item) => sum + item.revenue, 0),
  })
  const metaSummary = summarize(metaCampaigns)
  const googleSummary = summarize(googleCampaigns)
  const linkedinSummary = {
    spend: liSpend || linkedinCampaigns.reduce((sum, item) => sum + item.spend, 0),
    impressions: liImpr || linkedinCampaigns.reduce((sum, item) => sum + item.impressions, 0),
    clicks: liClicks || linkedinCampaigns.reduce((sum, item) => sum + item.clicks, 0),
    conversions: liConv || linkedinCampaigns.reduce((sum, item) => sum + item.conversions, 0),
    revenue: 0,
  }
  const totalSpend = metaSummary.spend + googleSummary.spend + linkedinSummary.spend
  const totalImpr = metaSummary.impressions + googleSummary.impressions + linkedinSummary.impressions
  const totalClicks = metaSummary.clicks + googleSummary.clicks + linkedinSummary.clicks
  const totalConv = metaSummary.conversions + googleSummary.conversions + linkedinSummary.conversions
  const totalRev = metaSummary.revenue + googleSummary.revenue

  const previousRoas = prevSpend > 0 && prevRev > 0 ? prevRev / prevSpend : null
  const metaDetails = Array.from(metaBreakdownMap.values()).sort((a, b) => b.spend - a.spend)
  const googleDetails = Array.from(googleBreakdownMap.values()).sort((a, b) => b.spend - a.spend)
  const linkedinDetails = Array.from(linkedinBreakdownMap.values()).sort((a, b) => b.spend - a.spend)

  return {
    spend: totalSpend,
    impressions: totalImpr,
    clicks: totalClicks,
    conversions: totalConv,
    revenue: totalRev,
    roas: totalSpend > 0 && totalRev > 0 ? totalRev / totalSpend : null,
    ctr: totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0,
    cpa: totalConv > 0 ? totalSpend / totalConv : null,
    dailySpend: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    campaigns: campaigns.sort((a, b) => b.spend - a.spend),
    platformBreakdown: {
      meta: metaSummary,
      google: googleSummary,
      linkedin: linkedinSummary,
    },
    detailBreakdowns: {
      meta: metaDetails,
      google: googleDetails,
      linkedin: linkedinDetails,
    },
    detailDailySpend: {
      meta: finalizeSeries(metaDetailDailyMap),
      google: finalizeSeries(googleDetailDailyMap),
      linkedin: finalizeSeries(linkedinDetailDailyMap),
    },
    previous: {
      spend: prevSpend,
      impressions: prevImpr,
      clicks: prevClicks,
      conversions: prevConv,
      roas: previousRoas,
    },
    errors,
    connectionErrors,
    allPaused: campaigns.length > 0 && campaigns.every(item => item.status === 'PAUSED'),
    connected: {
      meta: Boolean(meta?.accessToken && meta?.accountId),
      google: Boolean(google?.customerId),
      linkedin: Boolean(linkedin?.accessToken && linkedin?.adAccountId),
    },
    currency,
  }
}

export async function getGoogleCampaignsForUser(params: { userId: string }) {
  await connectDB()
  const user = await User.findById(params.userId).select('connections').lean() as { connections?: UserConnections } | null
  const google = user?.connections?.google
  if (!google?.customerId) {
    return { campaigns: [], errors: ['Google Ads not connected'] }
  }

  const token = await getValidGoogleToken(params.userId, 'google')
  if (!token) {
    return { campaigns: [], errors: ['Google token missing or expired'] }
  }

  const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN
  if (!developerToken) {
    return { campaigns: [], errors: ['No Google Ads developer token'] }
  }

  const query = `
    SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
           campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    LIMIT 50
  `

  const rows = await runGoogleAdsQuery({
    customerId: google.customerId,
    token,
    developerToken,
    query,
  })

  return {
    campaigns: (rows as Array<{ campaign?: Record<string, unknown>; campaignBudget?: Record<string, unknown> }>).map(row => ({
      id: row.campaign?.id,
      name: row.campaign?.name,
      status: row.campaign?.status,
      channelType: row.campaign?.advertisingChannelType,
      dailyBudgetMicros: row.campaignBudget?.amountMicros,
      platform: 'google',
    })),
    errors: [] as string[],
  }
}

export async function getLinkedInCampaignsForUser(params: { userId: string }) {
  await connectDB()
  const rawUser = await mongoose.connection.db!
    .collection('users')
    .findOne(
      { _id: new mongoose.Types.ObjectId(params.userId) },
      { projection: { 'connections.linkedin.accessToken': 1, 'connections.linkedin.adAccountId': 1 } }
    ) as { connections?: { linkedin?: { accessToken?: string; adAccountId?: string } } } | null

  const linkedin = rawUser?.connections?.linkedin
  if (!linkedin?.accessToken || !linkedin.adAccountId) {
    return { campaigns: [], errors: ['LinkedIn Ads not connected or no ad account selected'] }
  }

  try {
    const headers = {
      Authorization: `Bearer ${linkedin.accessToken}`,
      'LinkedIn-Version': '202504',
      'X-Restli-Protocol-Version': '2.0.0',
    }
    const accountId = String(linkedin.adAccountId)
    // Current LinkedIn campaigns search is account-scoped:
    // /rest/adAccounts/{adAccountId}/adCampaigns?q=search
    // Search criteria is optional for a basic fetch, pageSize caps the result size.
    const res = await axios.get(
      `https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaigns?q=search&pageSize=100`,
      { headers }
    )
    const elements = (res.data?.elements ?? []) as Array<{
      id?: number
      name?: string
      status?: string
      type?: string
      dailyBudget?: { amount?: string }
      totalBudget?: { amount?: string }
    }>
    return {
      campaigns: elements.map(c => ({
        id: String(c.id ?? ''),
        name: c.name ?? 'Unknown',
        status: c.status ?? 'UNKNOWN',
        objective: c.type,
        daily_budget: c.dailyBudget?.amount
          ? String(Math.round(parseFloat(c.dailyBudget.amount) * 100))
          : undefined,
        lifetime_budget: c.totalBudget?.amount
          ? String(Math.round(parseFloat(c.totalBudget.amount) * 100))
          : undefined,
        platform: 'linkedin',
      })),
      errors: [] as string[],
    }
  } catch (err) {
    const msg = axios.isAxiosError(err) ? JSON.stringify(err.response?.data) : String(err)
    console.error('[linkedin campaigns] fetch failed:', msg)
    return { campaigns: [], errors: [`LinkedIn campaigns failed: ${msg.slice(0, 200)}`] }
  }
}

import { NextRequest } from 'next/server'
import Brand from '@/models/Brand'
import { getUserConnections, makeConnectionError, parseMetaApiError, type ConnectionError } from '@/lib/get-user-connections'
import { getValidGoogleToken } from '@/lib/google-auth'
import axios from 'axios'

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

export interface DailyEntry { date: string; meta: number; google: number }

function fmt(d: Date) { return d.toISOString().split('T')[0] }

function buildRange(days: number, offsetDays = 0) {
  const until = new Date()
  until.setDate(until.getDate() - 1 - offsetDays)
  const since = new Date(until)
  since.setDate(since.getDate() - days + 1)
  return { since: fmt(since), until: fmt(until) }
}

function pickActions(arr: Array<{ action_type: string; value: string }> | undefined, types: string[]): number {
  return (arr ?? []).filter(a => types.includes(a.action_type)).reduce((s, a) => s + parseFloat(a.value ?? '0'), 0)
}

const CONV_TYPES = ['purchase', 'omni_purchase', 'complete_registration', 'lead']
const REV_TYPES  = ['purchase', 'omni_purchase']

export async function GET(req: NextRequest) {

  const sp = new URL(req.url).searchParams
  const days = parseInt(sp.get('days') ?? '30')
  const sinceParam = sp.get('since')
  const untilParam = sp.get('until')

  const curr = sinceParam && untilParam ? { since: sinceParam, until: untilParam } : buildRange(days)
  const actualDays = sinceParam && untilParam
    ? Math.ceil((new Date(untilParam).getTime() - new Date(sinceParam).getTime()) / 86400000) + 1
    : days
  const prev = buildRange(actualDays, actualDays)

  let user, userId: string
  try {
    ;({ user, userId } = await getUserConnections())
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Brand needed for currency — connectDB already called by getUserConnections
  const brand = await Brand.findOne({ userId }).lean()
  const currency: string = (brand as { currency?: string } | null)?.currency ?? 'INR'

  const connectionErrors: ConnectionError[] = []

  const errors: string[] = []
  const campaigns: CampaignInsight[] = []
  const dailyMap = new Map<string, DailyEntry>()

  let prevSpend = 0, prevImpr = 0, prevClicks = 0, prevConv = 0, prevRev = 0

  // ─── Meta Insights ────────────────────────────────────────────────
  const meta = user.connections?.meta
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

      const [insRes, prevRes, campRes] = await Promise.all([
        axios.get(`https://graph.facebook.com/v21.0/act_${accountId}/insights`, {
          params: { access_token: meta.accessToken, fields, level: 'campaign', time_increment: 1, time_range: timeRange, limit: 1000 },
        }),
        axios.get(`https://graph.facebook.com/v21.0/act_${accountId}/insights`, {
          params: { access_token: meta.accessToken, fields: 'spend,impressions,clicks,actions,action_values', time_range: prevTimeRange, limit: 1 },
        }),
        axios.get(`https://graph.facebook.com/v21.0/act_${accountId}/campaigns`, {
          params: { access_token: meta.accessToken, fields: 'id,name,status', limit: 200 },
        }),
      ])

      const statusMap = new Map<string, string>()
      for (const c of (campRes.data.data ?? [])) statusMap.set(c.id, c.status)

      const aggMap = new Map<string, CampaignInsight>()
      for (const row of (insRes.data.data ?? [])) {
        const date = row.date_start as string
        const spend = parseFloat(row.spend ?? '0')
        const entry = dailyMap.get(date) ?? { date, meta: 0, google: 0 }
        entry.meta += spend
        dailyMap.set(date, entry)

        const cid = row.campaign_id as string
        const agg = aggMap.get(cid) ?? {
          id: cid, name: row.campaign_name as string, platform: 'meta', status: statusMap.get(cid) ?? 'UNKNOWN',
          spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, roas: null, ctr: 0, cpa: null,
        }
        agg.spend += spend
        agg.impressions += parseInt(row.impressions ?? '0')
        agg.clicks += parseInt(row.clicks ?? '0')
        agg.conversions += pickActions(row.actions, CONV_TYPES)
        agg.revenue += pickActions(row.action_values, REV_TYPES)
        aggMap.set(cid, agg)
      }

      for (const [, c] of aggMap) {
        c.ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
        c.roas = c.spend > 0 && c.revenue > 0 ? c.revenue / c.spend : null
        c.cpa = c.conversions > 0 ? c.spend / c.conversions : null
        campaigns.push(c)
      }

      const pd = prevRes.data.data?.[0]
      if (pd) {
        const pConv = pickActions(pd.actions, CONV_TYPES)
        const pRev = pickActions(pd.action_values, REV_TYPES)
        prevSpend += parseFloat(pd.spend ?? '0')
        prevImpr += parseInt(pd.impressions ?? '0')
        prevClicks += parseInt(pd.clicks ?? '0')
        prevConv += pConv
        prevRev += pRev
      }
    } catch (err) {
      console.error('[ads/insights] Meta error:', err)
      const parsed = parseMetaApiError(err)
      if (parsed) {
        connectionErrors.push({ ...makeConnectionError(parsed.code), message: `Meta Ads: ${parsed.detail} — reconnect in Settings` })
      } else {
        errors.push('Meta Ads insights failed — check your connection in Settings')
      }
    }
  }

  // ─── Google Ads Insights ──────────────────────────────────────────
  const google = user.connections?.google
  if (!google?.customerId) {
    connectionErrors.push(makeConnectionError('GOOGLE_NOT_CONNECTED'))
  } else {
    try {
      const token = await getValidGoogleToken(userId, 'google')
      if (!token) throw new Error('No Google token')
      const devToken = process.env.GOOGLE_DEVELOPER_TOKEN
      if (!devToken) throw new Error('No developer token')

      const cid = google.customerId.replace(/-/g, '')
      const headers = {
        Authorization: `Bearer ${token}`,
        'developer-token': devToken,
        'login-customer-id': cid,
        'Content-Type': 'application/json',
      }

      const query = `
        SELECT campaign.id, campaign.name, campaign.status,
               metrics.cost_micros, metrics.impressions, metrics.clicks,
               metrics.conversions, metrics.conversion_value, metrics.ctr,
               segments.date
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

      const [res, prevRes] = await Promise.all([
        axios.post(`https://googleads.googleapis.com/v19/customers/${cid}/googleAds:search`,
          { query: query.trim() }, { headers }),
        axios.post(`https://googleads.googleapis.com/v19/customers/${cid}/googleAds:search`,
          { query: prevQuery.trim() }, { headers }),
      ])

      const gAgg = new Map<string, CampaignInsight>()
      for (const row of (res.data.results ?? [])) {
        const date = row.segments?.date as string
        const spend = parseInt(String(row.metrics?.costMicros ?? '0')) / 1_000_000
        const entry = dailyMap.get(date) ?? { date, meta: 0, google: 0 }
        entry.google += spend
        dailyMap.set(date, entry)

        const gid = String(row.campaign?.id ?? '')
        const agg = gAgg.get(gid) ?? {
          id: gid, name: row.campaign?.name ?? 'Unknown', platform: 'google', status: row.campaign?.status ?? 'UNKNOWN',
          spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, roas: null, ctr: 0, cpa: null,
        }
        agg.spend += spend
        agg.impressions += row.metrics?.impressions ?? 0
        agg.clicks += row.metrics?.clicks ?? 0
        agg.conversions += row.metrics?.conversions ?? 0
        agg.revenue += row.metrics?.conversionValue ?? 0
        gAgg.set(gid, agg)
      }

      for (const [, c] of gAgg) {
        c.ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
        c.roas = c.spend > 0 && c.revenue > 0 ? c.revenue / c.spend : null
        c.cpa = c.conversions > 0 ? c.spend / c.conversions : null
        campaigns.push(c)
      }

      for (const row of (prevRes.data.results ?? [])) {
        prevSpend += parseInt(String(row.metrics?.costMicros ?? '0')) / 1_000_000
        prevImpr += row.metrics?.impressions ?? 0
        prevClicks += row.metrics?.clicks ?? 0
        prevConv += row.metrics?.conversions ?? 0
        prevRev += row.metrics?.conversionValue ?? 0
      }
    } catch (err) {
      const e = err as { response?: { data?: unknown; status?: number }; message?: string }
      const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message
      console.error('[ads/insights] Google error status:', e.response?.status)
      console.error('[ads/insights] Google error detail:', detail)
      const isUnimplemented = detail?.includes('UNIMPLEMENTED') || detail?.includes('DEVELOPER_TOKEN')
      errors.push(isUnimplemented ? 'UNIMPLEMENTED: Google Ads developer token requires Standard Access approval' : `Google Ads insights failed: ${detail?.slice(0, 200)}`)
    }
  }

  // ─── Totals ───────────────────────────────────────────────────────
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const totalImpr  = campaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0)
  const totalConv  = campaigns.reduce((s, c) => s + c.conversions, 0)
  const totalRev   = campaigns.reduce((s, c) => s + c.revenue, 0)

  const metaCamps  = campaigns.filter(c => c.platform === 'meta')
  const gCamps     = campaigns.filter(c => c.platform === 'google')
  const metaSpend  = metaCamps.reduce((s, c) => s + c.spend, 0)
  const gSpend     = gCamps.reduce((s, c) => s + c.spend, 0)

  const prevBlendedRoas = prevSpend > 0 && prevRev > 0 ? prevRev / prevSpend : null

  return Response.json({
    spend: totalSpend,
    impressions: totalImpr,
    clicks: totalClicks,
    conversions: totalConv,
    revenue: totalRev,
    roas: totalSpend > 0 && totalRev > 0 ? totalRev / totalSpend : null,
    ctr: totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0,
    cpa: totalConv > 0 ? totalSpend / totalConv : null,
    dailySpend: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    campaigns,
    platformBreakdown: {
      meta: { spend: metaSpend, impressions: metaCamps.reduce((s, c) => s + c.impressions, 0) },
      google: { spend: gSpend, impressions: gCamps.reduce((s, c) => s + c.impressions, 0) },
    },
    previous: { spend: prevSpend, impressions: prevImpr, clicks: prevClicks, conversions: prevConv, roas: prevBlendedRoas },
    errors,
    connectionErrors,
    allPaused: campaigns.length > 0 && campaigns.every(c => c.status === 'PAUSED'),
    connected: { meta: !!(meta?.accessToken && meta?.accountId), google: !!(google?.customerId) },
    currency,
  })
}

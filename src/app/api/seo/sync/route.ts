import { NextRequest } from 'next/server'
import Keyword from '@/models/Keyword'
import { getUserConnections, connectionErrorResponse } from '@/lib/get-user-connections'
import { getValidGoogleToken } from '@/lib/google-auth'
import axios from 'axios'

export async function POST(_req: NextRequest) {
  let user, userId: string
  try {
    ;({ user, userId } = await getUserConnections())
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sc = user.connections?.searchConsole
  if (!sc?.siteUrl) {
    return connectionErrorResponse('SEARCH_CONSOLE_NOT_CONNECTED')
  }

  const accessToken = await getValidGoogleToken(userId, 'searchConsole')
  if (!accessToken) {
    return connectionErrorResponse('TOKEN_EXPIRED', 401)
  }

  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 490 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 16 months

  const res = await axios.post(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(sc.siteUrl)}/searchAnalytics/query`,
    { startDate, endDate, dimensions: ['query'], rowLimit: 1000 },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  const rows = res.data.rows || []
  console.log(`[GSC Sync] siteUrl: ${sc.siteUrl}, rows returned: ${rows.length}, dateRange: ${startDate} to ${endDate}`)

  let synced = 0
  for (const row of rows) {
    const keyword = row.keys[0]
    await Keyword.findOneAndUpdate(
      { userId, keyword },
      { userId, keyword, source: 'search_console', clicks: Math.round(row.clicks), impressions: Math.round(row.impressions), currentPosition: Math.round(row.position) },
      { upsert: true, new: true }
    )
    synced++
  }

  const totalClicks = rows.reduce((s: number, r: { clicks: number }) => s + r.clicks, 0)
  const totalImpressions = rows.reduce((s: number, r: { impressions: number }) => s + r.impressions, 0)

  return Response.json({ success: true, synced, totalClicks: Math.round(totalClicks), totalImpressions: Math.round(totalImpressions), siteUrl: sc.siteUrl })
}

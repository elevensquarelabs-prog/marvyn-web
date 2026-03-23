import { NextRequest } from 'next/server'
import { getUserConnections, connectionErrorResponse } from '@/lib/get-user-connections'
import { getValidGoogleToken } from '@/lib/google-auth'
import axios from 'axios'

export async function GET(_req: NextRequest) {
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
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const res = await axios.post(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(sc.siteUrl)}/searchAnalytics/query`,
    {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 100,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  const rows = (res.data.rows || []).map((row: {
    keys: string[]
    clicks: number
    impressions: number
    ctr: number
    position: number
  }) => ({
    page: row.keys[0],
    clicks: Math.round(row.clicks),
    impressions: Math.round(row.impressions),
    ctr: parseFloat((row.ctr * 100).toFixed(2)),
    position: parseFloat(row.position.toFixed(1)),
  }))

  return Response.json({ pages: rows, siteUrl: sc.siteUrl })
}

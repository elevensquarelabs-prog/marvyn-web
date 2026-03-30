import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserConnections, makeConnectionError, parseMetaApiError, type ConnectionError } from '@/lib/get-user-connections'
import { getGoogleCampaignsForUser, getLinkedInCampaignsForUser } from '@/lib/ads-performance'
import axios from 'axios'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let user, userId: string
  try {
    ;({ user, userId } = await getUserConnections())
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const campaigns: unknown[] = []
  const errors: string[] = []
  const connectionErrors: ConnectionError[] = []

  // ─── Meta Ads ─────────────────────────────────────────────────────
  const meta = user.connections?.meta
  if (!meta?.accessToken) {
    connectionErrors.push(makeConnectionError('META_NOT_CONNECTED'))
  } else if (!meta.accountId) {
    connectionErrors.push(makeConnectionError('META_ACCOUNT_NOT_SELECTED'))
  } else {
    try {
      const accountId = String(meta.accountId).replace(/^act_/, '')
      const res = await axios.get(
        `https://graph.facebook.com/v21.0/act_${accountId}/campaigns`,
        {
          params: {
            access_token: meta.accessToken,
            fields: 'id,name,status,objective,daily_budget,lifetime_budget',
            limit: 50,
          },
        }
      )
      const metaCampaigns = (res.data.data || []).map((c: Record<string, unknown>) => ({ ...c, platform: 'meta' }))
      campaigns.push(...metaCampaigns)
      console.log(`[campaigns] Meta: fetched ${metaCampaigns.length} campaigns for account ${accountId}`)
    } catch (err) {
      console.error('[campaigns] Meta Ads fetch failed:', err)
      const parsed = parseMetaApiError(err)
      if (parsed) {
        connectionErrors.push({ ...makeConnectionError(parsed.code), message: `Meta Ads: ${parsed.detail} — reconnect in Settings` })
      } else {
        errors.push('Meta Ads fetch failed — check your connection in Settings')
      }
    }
  }

  // ─── Google Ads ───────────────────────────────────────────────────
  const google = user.connections?.google
  if (!google?.customerId) {
    connectionErrors.push(makeConnectionError('GOOGLE_NOT_CONNECTED'))
  } else {
    try {
      const result = await getGoogleCampaignsForUser({ userId })
      campaigns.push(...result.campaigns)
      errors.push(...result.errors)
    } catch (err) {
      const e = err as { response?: { data?: unknown; status?: number }; message?: string }
      const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message
      console.error('[campaigns] Google Ads fetch failed status:', e.response?.status)
      console.error('[campaigns] Google Ads fetch failed detail:', detail)
      errors.push(`Google Ads fetch failed: ${detail?.slice(0, 300)}`)
    }
  }

  // ─── LinkedIn Ads ─────────────────────────────────────────────────
  const linkedin = user.connections?.linkedin as { accessToken?: string; adAccountId?: string } | undefined
  if (linkedin?.accessToken && linkedin.adAccountId) {
    try {
      const result = await getLinkedInCampaignsForUser({ userId })
      campaigns.push(...result.campaigns)
      errors.push(...result.errors)
    } catch (err) {
      const e = err as { message?: string }
      errors.push(`LinkedIn campaigns failed: ${e.message ?? 'Unknown error'}`)
    }
  }

  return Response.json({ campaigns, errors, connectionErrors })
}

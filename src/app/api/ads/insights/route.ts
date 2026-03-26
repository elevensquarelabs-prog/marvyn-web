import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAdsInsightsForUser } from '@/lib/ads-performance'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const days = parseInt(sp.get('days') ?? '30')
  const since = sp.get('since') || undefined
  const until = sp.get('until') || undefined

  const payload = await getAdsInsightsForUser({
    userId: session.user.id,
    days,
    since,
    until,
  })

  return Response.json(payload)
}

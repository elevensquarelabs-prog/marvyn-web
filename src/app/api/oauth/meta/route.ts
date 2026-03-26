import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const appId = (process.env.META_APP_ID || '').trim()
  const redirectUri = `${BASE_URL()}/api/oauth/meta/callback`
  const scope = 'ads_read,ads_management,business_management'
  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${session.user.id}`

  return Response.json({ authUrl })
}

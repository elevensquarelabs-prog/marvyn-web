import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateOAuthState } from '@/lib/oauth-state'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const from = new URL(req.url).searchParams.get('from')
  const state = generateOAuthState(session.user.id, from ?? undefined)

  const appId = (process.env.META_APP_ID || '').trim()
  const redirectUri = `${BASE_URL()}/api/oauth/meta/callback`
  const scope = [
    'ads_read',
    'ads_management',
    'business_management',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_manage_insights',
    'instagram_content_publish',
  ].join(',')
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope,
    response_type: 'code',
    auth_type: 'rerequest',
    state,
  })
  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`

  return Response.json({ authUrl })
}

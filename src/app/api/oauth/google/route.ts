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

  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
  const redirectUri = `${BASE_URL()}/api/oauth/google/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/webmasters.readonly',
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'false',
    state,
  })
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return Response.json({ authUrl })
}

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
  const redirectUri = `${BASE_URL()}/api/oauth/ga4/callback`
  const scope = encodeURIComponent('https://www.googleapis.com/auth/analytics.readonly')
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`

  return Response.json({ authUrl })
}

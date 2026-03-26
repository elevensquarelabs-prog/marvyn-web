import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${BASE_URL()}/api/oauth/google/callback`
  console.log('[Google OAuth] NEXTAUTH_URL:', BASE_URL())
  console.log('[Google OAuth] redirect_uri:', redirectUri)
  const scope = encodeURIComponent('https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/webmasters.readonly')
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${session.user.id}`

  return Response.json({ authUrl })
}

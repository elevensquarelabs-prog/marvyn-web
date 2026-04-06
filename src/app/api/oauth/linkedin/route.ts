import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = (process.env.LINKEDIN_CLIENT_ID || '').trim()
  const redirectUri = `${process.env.NEXTAUTH_URL?.trim()}/api/oauth/linkedin/callback`
  console.log('[LinkedIn] redirect_uri:', redirectUri)
  const scope = encodeURIComponent([
    'openid',
    'profile',
    'email',
    'w_member_social',
    'r_ads',
    'r_ads_reporting',
    'r_organization_admin',
    'rw_organization_admin',
    'r_organization_social',
    'w_organization_social',
  ].join(' '))
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${session.user.id}&prompt=consent`

  return Response.json({ authUrl })
}

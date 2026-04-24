import { NextRequest } from 'next/server'
import { verifyMarvynSocialAccessToken } from '@/lib/marvyn-social-oauth'

export async function GET(req: NextRequest) {
  const authorization = req.headers.get('authorization') || ''
  const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || []

  if (!token) {
    return Response.json({ error: 'invalid_token' }, { status: 401 })
  }

  try {
    const payload = await verifyMarvynSocialAccessToken(token)
    return Response.json({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
    })
  } catch {
    return Response.json({ error: 'invalid_token' }, { status: 401 })
  }
}

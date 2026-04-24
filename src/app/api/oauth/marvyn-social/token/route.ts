import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import {
  consumeMarvynSocialAuthorizationCode,
  createMarvynSocialAccessTokenForSubject,
  isAllowedMarvynSocialRedirectUri,
  validateMarvynSocialClient,
} from '@/lib/marvyn-social-oauth'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const grantType = String(form.get('grant_type') || '')
  const clientId = String(form.get('client_id') || '')
  const clientSecret = String(form.get('client_secret') || '')
  const code = String(form.get('code') || '')
  const redirectUri = String(form.get('redirect_uri') || '')

  if (grantType !== 'authorization_code') {
    return Response.json({ error: 'unsupported_grant_type' }, { status: 400 })
  }

  if (!validateMarvynSocialClient(clientId, clientSecret)) {
    return Response.json({ error: 'invalid_client' }, { status: 401 })
  }

  if (!code || !isAllowedMarvynSocialRedirectUri(redirectUri)) {
    return Response.json({ error: 'invalid_grant' }, { status: 400 })
  }

  await connectDB()
  const storedCode = await consumeMarvynSocialAuthorizationCode({ code, redirectUri })
  if (!storedCode) {
    return Response.json({ error: 'invalid_grant' }, { status: 400 })
  }

  const accessToken = await createMarvynSocialAccessTokenForSubject({
    sub: String(storedCode.userId),
    email: storedCode.email,
    name: storedCode.name,
  })

  return Response.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 600,
  })
}

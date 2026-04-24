import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import {
  buildAuthorizationRedirect,
  buildLoginRedirect,
  isAllowedMarvynSocialRedirectUri,
  issueMarvynSocialAuthorizationCode,
} from '@/lib/marvyn-social-oauth'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const clientId = params.get('client_id')
  const redirectUri = params.get('redirect_uri')
  const responseType = params.get('response_type')
  const state = params.get('state')

  if (clientId !== process.env.MARVYN_SOCIAL_CLIENT_ID) {
    return Response.json({ error: 'invalid_client' }, { status: 400 })
  }

  if (responseType !== 'code') {
    return Response.json({ error: 'unsupported_response_type' }, { status: 400 })
  }

  if (!isAllowedMarvynSocialRedirectUri(redirectUri)) {
    return Response.json({ error: 'invalid_redirect_uri' }, { status: 400 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.redirect(buildLoginRedirect(req.url))
  }

  await connectDB()
  const user = await User.findById(session.user.id).select('email name').lean()
  if (!user?.email || !redirectUri) {
    return Response.json({ error: 'access_denied' }, { status: 403 })
  }

  const code = await issueMarvynSocialAuthorizationCode({
    userId: session.user.id,
    email: user.email,
    name: user.name,
    redirectUri,
  })

  return NextResponse.redirect(buildAuthorizationRedirect({ redirectUri, code, state }))
}

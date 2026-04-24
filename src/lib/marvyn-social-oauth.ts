import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import type { IUser } from '@/models/User'
import MarvynSocialOAuthCode from '@/models/MarvynSocialOAuthCode'

const ACCESS_TOKEN_TTL_SECONDS = 10 * 60
const CODE_TTL_MINUTES = 5

export interface MarvynSocialOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUris: string[]
  socialUrl: string
  signingSecret: string
}

export interface MarvynSocialAccessTokenPayload {
  sub: string
  email: string
  name?: string
}

export function getMarvynSocialOAuthConfig(): MarvynSocialOAuthConfig {
  const clientId = process.env.MARVYN_SOCIAL_CLIENT_ID
  const clientSecret = process.env.MARVYN_SOCIAL_CLIENT_SECRET
  const redirectUri = process.env.MARVYN_SOCIAL_REDIRECT_URI
  const socialUrl = process.env.MARVYN_SOCIAL_URL
  const signingSecret = process.env.NEXTAUTH_SECRET

  if (!clientId || !clientSecret || !redirectUri || !socialUrl || !signingSecret) {
    throw new Error('Marvyn Social OAuth environment variables are not set')
  }

  return {
    clientId,
    clientSecret,
    redirectUris: redirectUri.split(',').map(uri => uri.trim()).filter(Boolean),
    socialUrl,
    signingSecret,
  }
}

export function validateMarvynSocialClient(clientId?: string | null, clientSecret?: string | null): boolean {
  const config = getMarvynSocialOAuthConfig()
  return clientId === config.clientId && clientSecret === config.clientSecret
}

export function isAllowedMarvynSocialRedirectUri(redirectUri?: string | null): boolean {
  if (!redirectUri) return false
  return getMarvynSocialOAuthConfig().redirectUris.includes(redirectUri)
}

export function buildAuthorizationRedirect({
  redirectUri,
  code,
  state,
}: {
  redirectUri: string
  code: string
  state?: string | null
}): string {
  const url = new URL(redirectUri)
  url.searchParams.set('code', code)
  if (state) url.searchParams.set('state', state)
  url.searchParams.set('provider', 'generic')
  return url.toString()
}

export function buildLoginRedirect(requestUrl: string): string {
  const url = new URL('/login', requestUrl)
  url.searchParams.set('callbackUrl', requestUrl)
  return url.toString()
}

export function hashOAuthCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function issueMarvynSocialAuthorizationCode({
  userId,
  email,
  name,
  redirectUri,
}: {
  userId: string
  email: string
  name?: string | null
  redirectUri: string
}): Promise<string> {
  const code = crypto.randomBytes(32).toString('base64url')
  await MarvynSocialOAuthCode.create({
    codeHash: hashOAuthCode(code),
    userId,
    email,
    name,
    redirectUri,
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
  })
  return code
}

export async function consumeMarvynSocialAuthorizationCode({
  code,
  redirectUri,
}: {
  code: string
  redirectUri: string
}) {
  const codeHash = hashOAuthCode(code)
  const storedCode = await MarvynSocialOAuthCode.findOneAndDelete({
    codeHash,
    redirectUri,
    expiresAt: { $gt: new Date() },
  }).lean()

  return storedCode
}

export async function createMarvynSocialAccessToken(user: Pick<IUser, '_id' | 'email' | 'name'>): Promise<string> {
  return createMarvynSocialAccessTokenForSubject({
    sub: String(user._id),
    email: user.email,
    name: user.name,
  })
}

export async function createMarvynSocialAccessTokenForSubject(user: MarvynSocialAccessTokenPayload): Promise<string> {
  const config = getMarvynSocialOAuthConfig()
  const secret = new TextEncoder().encode(config.signingSecret)

  return new SignJWT({
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.sub)
    .setAudience(config.clientId)
    .setIssuer('marvyn')
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret)
}

export async function verifyMarvynSocialAccessToken(token: string): Promise<MarvynSocialAccessTokenPayload> {
  const config = getMarvynSocialOAuthConfig()
  const secret = new TextEncoder().encode(config.signingSecret)
  const { payload } = await jwtVerify(token, secret, {
    audience: config.clientId,
    issuer: 'marvyn',
  })

  if (!payload.sub || typeof payload.email !== 'string') {
    throw new Error('Invalid Marvyn Social access token')
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  }
}

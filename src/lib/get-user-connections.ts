import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { connectDB } from './mongodb'
import User from '@/models/User'

export interface UserConnections {
  meta?: { accessToken?: string; accountId?: string; accountName?: string }
  google?: { accessToken?: string; refreshToken?: string; customerId?: string }
  searchConsole?: { accessToken?: string; refreshToken?: string; siteUrl?: string }
  ga4?: { accessToken?: string; refreshToken?: string; propertyId?: string; propertyName?: string; accountName?: string; connectedAt?: Date }
  linkedin?: { accessToken?: string; profileId?: string; profileName?: string }
  facebook?: { pageAccessToken?: string; pageId?: string; pageName?: string; accessToken?: string }
  instagram?: { accountId?: string }
  clarity?: { projectId?: string; apiToken?: string; connectedAt?: Date }
}

export interface ConnectionUser {
  _id: string
  connections: UserConnections
}

export async function getUserConnections(): Promise<{ user: ConnectionUser; userId: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Not authenticated')

  await connectDB()
  const user = await User.findById(session.user.id).select('connections subscription').lean()
  if (!user) throw new Error('User not found')

  return { user: user as unknown as ConnectionUser, userId: session.user.id }
}

// ─── Structured error helpers ──────────────────────────────────────────────

export type ConnectionErrorCode =
  | 'META_NOT_CONNECTED'
  | 'META_ACCOUNT_NOT_SELECTED'
  | 'GOOGLE_NOT_CONNECTED'
  | 'SEARCH_CONSOLE_NOT_CONNECTED'
  | 'GA4_NOT_CONNECTED'
  | 'LINKEDIN_NOT_CONNECTED'
  | 'FACEBOOK_NOT_CONNECTED'
  | 'TOKEN_EXPIRED'

export interface ConnectionError {
  code: ConnectionErrorCode
  message: string
  platform: string
  settingsUrl: string
}

export const CONNECTION_ERRORS: Record<ConnectionErrorCode, Omit<ConnectionError, 'code'>> = {
  META_NOT_CONNECTED: {
    platform: 'meta',
    message: 'Connect Meta Ads in Settings to see campaign data',
    settingsUrl: '/settings',
  },
  META_ACCOUNT_NOT_SELECTED: {
    platform: 'meta',
    message: 'Select a Meta Ads account in Settings to continue',
    settingsUrl: '/settings',
  },
  GOOGLE_NOT_CONNECTED: {
    platform: 'google',
    message: 'Connect Google Ads in Settings to see campaign data',
    settingsUrl: '/settings',
  },
  SEARCH_CONSOLE_NOT_CONNECTED: {
    platform: 'searchConsole',
    message: 'Connect Google Search Console in Settings to sync keywords',
    settingsUrl: '/settings',
  },
  GA4_NOT_CONNECTED: {
    platform: 'ga4',
    message: 'Connect Google Analytics 4 in Settings to see session and conversion data',
    settingsUrl: '/settings',
  },
  LINKEDIN_NOT_CONNECTED: {
    platform: 'linkedin',
    message: 'Connect LinkedIn in Settings to publish posts',
    settingsUrl: '/settings',
  },
  FACEBOOK_NOT_CONNECTED: {
    platform: 'facebook',
    message: 'Connect a Facebook Page in Settings to publish posts',
    settingsUrl: '/settings',
  },
  TOKEN_EXPIRED: {
    platform: 'unknown',
    message: 'Your connection has expired — reconnect in Settings',
    settingsUrl: '/settings',
  },
}

export function makeConnectionError(code: ConnectionErrorCode): ConnectionError {
  return { code, ...CONNECTION_ERRORS[code] }
}

export function connectionErrorResponse(code: ConnectionErrorCode, status = 400) {
  const err = makeConnectionError(code)
  return Response.json({ error: err.code, message: err.message, platform: err.platform, settingsUrl: err.settingsUrl }, { status })
}

// ─── Meta API error parsing ────────────────────────────────────────────────

interface MetaApiError {
  code: number
  type?: string
  message?: string
  error_subcode?: number
}

/**
 * Given an Axios error from a Meta Graph API call, returns a ConnectionErrorCode
 * if the error indicates a credential/permission problem, or null for transient errors.
 */
export function parseMetaApiError(err: unknown): { code: ConnectionErrorCode; detail: string } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const axErr = err as any
  const metaErr: MetaApiError | undefined = axErr?.response?.data?.error
  if (!metaErr) return null

  const code = metaErr.code
  const detail = metaErr.message ?? 'Unknown Meta error'

  console.error('[meta] API error code:', code, '| subcode:', metaErr.error_subcode, '| message:', detail)

  // Token invalid / expired / wrong user
  if (code === 190) return { code: 'TOKEN_EXPIRED', detail }

  // No permission to this ad account (switched accounts)
  if (code === 200 || code === 10 || code === 100) {
    // subcode 1870145: user doesn't have access to this ad account
    return { code: 'META_ACCOUNT_NOT_SELECTED', detail }
  }

  // App not installed for this user / session invalidated
  if (code === 2500 || metaErr.type === 'OAuthException') return { code: 'TOKEN_EXPIRED', detail }

  return null
}

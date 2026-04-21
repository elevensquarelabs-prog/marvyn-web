import crypto from 'crypto'

// State format: base64url( userId:from:nonce ) + "." + HMAC(payload, NEXTAUTH_SECRET)
// Stateless CSRF protection — the HMAC binds the state to the server secret,
// making it unforgeable without needing a store.

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET not set')
  return s
}

export function generateOAuthState(userId: string, from?: string): string {
  const nonce = crypto.randomBytes(16).toString('hex')
  const payload = `${userId}:${from ?? ''}:${nonce}`
  const b64 = Buffer.from(payload).toString('base64url')
  const hmac = crypto.createHmac('sha256', secret()).update(b64).digest('hex')
  return `${b64}.${hmac}`
}

export interface ParsedOAuthState {
  userId: string
  from: string
}

export function parseOAuthState(state: string): ParsedOAuthState {
  const [b64, hmac] = state.split('.')
  if (!b64 || !hmac) throw new Error('Malformed OAuth state')

  const expected = crypto.createHmac('sha256', secret()).update(b64).digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
    throw new Error('OAuth state HMAC mismatch — possible CSRF attempt')
  }

  const payload = Buffer.from(b64, 'base64url').toString()
  const [userId, from] = payload.split(':')
  if (!userId) throw new Error('OAuth state missing userId')

  return { userId, from: from ?? '' }
}

import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

// Defined here (not imported from AdminUser) so this file stays Edge-Runtime-safe.
// The middleware imports this file; any transitive import of mongoose would crash the Edge Runtime.
export type AdminRole = 'super_admin' | 'support' | 'billing_viewer'

const COOKIE_NAME = 'admin_session'
const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-prod'
)
const EXPIRY = '8h'

export interface AdminTokenPayload {
  adminId: string
  email: string
  name: string
  role: AdminRole
}

export async function signAdminToken(payload: AdminTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET)
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as AdminTokenPayload
  } catch {
    return null
  }
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 8,  // 8 hours
  }
}

/**
 * Role hierarchy — higher number = more permissions.
 *   billing_viewer: view-only (costs, user list)
 *   support:        + operational actions (revoke, approve, reset password)
 *   super_admin:    + create users, change plans, credits, manage admins
 */
const ROLE_LEVEL: Record<AdminRole, number> = {
  billing_viewer: 1,
  support: 2,
  super_admin: 3,
}

/**
 * Validates the admin_session cookie.
 * Throws a Response (401/403) if missing, invalid, or below minRole.
 * Usage in route handlers:
 *   let admin; try { admin = await requireAdmin(req, 'support') } catch (r) { return r as Response }
 */
export async function requireAdmin(
  req: NextRequest,
  minRole?: AdminRole
): Promise<AdminTokenPayload> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) throw Response.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyAdminToken(token)
  if (!payload) throw Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (minRole && ROLE_LEVEL[payload.role] < ROLE_LEVEL[minRole]) {
    throw Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return payload
}

export { COOKIE_NAME }

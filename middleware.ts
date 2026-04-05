import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken, COOKIE_NAME } from '@/lib/admin-auth'

const ADMIN_HOSTNAME = 'admin.marvyn.tech'

export async function middleware(req: NextRequest) {
  const hostname = (req.headers.get('host') ?? '').replace(/:\d+$/, '')
  const isAdminDomain = hostname === ADMIN_HOSTNAME || hostname === `www.${ADMIN_HOSTNAME}`

  if (!isAdminDomain) return NextResponse.next()

  const { pathname } = req.nextUrl

  // ─── API routes: always pass through, no rewriting ───────────────────────
  // admin.marvyn.tech/api/admin/... → Next.js resolves to src/app/api/admin/...
  // Each route handles its own auth via requireAdmin(). No middleware action needed.
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // ─── Page routes: rewrite to /admin prefix ────────────────────────────────
  // admin.marvyn.tech/          → rewrite → /admin/dashboard
  // admin.marvyn.tech/users     → rewrite → /admin/users
  // admin.marvyn.tech/login     → rewrite → /admin/login  (no auth needed)
  const adminPath = pathname === '/' ? '/admin/dashboard'
    : pathname.startsWith('/admin') ? pathname
    : `/admin${pathname}`

  // Login page: allow without cookie
  if (adminPath === '/admin/login') {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.rewrite(url)
  }

  // All other pages: require valid admin cookie
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyAdminToken(token) : null

  if (!payload) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  // Authenticated: rewrite to the /admin-prefixed path
  const url = req.nextUrl.clone()
  url.pathname = adminPath
  return NextResponse.rewrite(url)
}

export const config = {
  // Skip Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

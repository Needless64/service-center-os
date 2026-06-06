import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin auth gate.
 *
 * Two paths into the admin area:
 *   1. /api/admin/* — server endpoints. Auth: admin_session cookie.
 *      Login/verify-otp/logout are allowlisted. Failure -> 401 JSON.
 *   2. /admin/* (page routes) — redirects to /admin/login?next=...
 *      when the cookie is missing or invalid. The login page is
 *      allowlisted so the form itself renders.
 *
 * The /admin/studio route is allowlisted (Sanity Studio has its
 * own session cookie + auth via the GROQ token).
 */
const ALLOWLIST_API = [
  '/api/admin/auth/login',
  '/api/admin/auth/verify-otp',
  '/api/admin/auth/logout',
]

const ALLOWLIST_PAGES = [
  '/admin/login',
  '/admin/studio',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api/admin/')) {
    if (ALLOWLIST_API.some((p) => pathname === p)) {
      return NextResponse.next()
    }
    const session = req.cookies.get('admin_session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin/')) {
    if (ALLOWLIST_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      return NextResponse.next()
    }
    const session = req.cookies.get('admin_session')?.value
    if (!session) {
      const next = encodeURIComponent(pathname + req.nextUrl.search)
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      url.search = `?next=${next}`
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  // Regex form. Matches every URL under /api/admin/ or /admin/.
  // Next.js path-to-regex matcher is finicky with combined patterns;
  // the single regex form is more reliable.
  matcher: ['/api/admin/(.*)', '/admin/(.*)'],
}

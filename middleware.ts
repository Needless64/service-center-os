import { NextRequest, NextResponse } from 'next/server'

/**
 * Gate every /api/admin/* route behind a logged-in admin session.
 *
 * Auth model: the admin_session cookie holds the admin's email (set
 * by /api/admin/auth/verify-otp after a successful email+password
 * + OTP login). We accept any cookie value here; the admin API
 * handlers themselves do not need the email — they trust the cookie
 * presence. For a stronger gate, also look up adminUser by email
 * here; the trade-off is one Sanity roundtrip per admin call.
 *
 * Login + verify-otp + logout are allowlisted (no auth required).
 *
 * Fail-closed: if the cookie is missing or empty, returns 401.
 */
const ALLOWLIST = [
  '/api/admin/auth/login',
  '/api/admin/auth/verify-otp',
  '/api/admin/auth/logout',
]

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/admin/')) {
    return NextResponse.next()
  }

  if (ALLOWLIST.some((p) => req.nextUrl.pathname === p)) {
    return NextResponse.next()
  }

  const session = req.cookies.get('admin_session')?.value
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/admin/:path*'],
}

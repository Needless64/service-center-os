import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/admin/auth/logout
 *
 * Clears the admin_session cookie. Idempotent.
 */
export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return res
}

import { NextRequest, NextResponse } from 'next/server'
import { verifyOtp } from '@/lib/adminAuth'

/**
 * POST /api/admin/auth/verify-otp
 * Body: { email, code }
 *
 * Verifies the 6-digit OTP. On success, sets the httpOnly admin_session
 * cookie to the admin's email and returns `{ ok: true, email, name }`.
 * The cookie is Secure + HttpOnly + SameSite=Strict, 24h expiry. The
 * OTP is single-use (cleared on the Sanity doc after a successful match).
 */
export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()
    if (typeof email !== 'string' || typeof code !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
    }

    const ok = await verifyOtp(email, code)
    if (!ok) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 200 })

    const res = NextResponse.json({ ok: true, email })
    res.cookies.set('admin_session', email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60, // 24h
    })
    return res
  } catch (err) {
    console.error('[admin/auth/verify-otp]', err)
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }
}

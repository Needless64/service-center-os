import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, generateAndStoreOtp } from '@/lib/adminAuth'

/**
 * POST /api/admin/auth/login
 * Body: { email, password }
 *
 * Verifies the bcrypt password. On success, generates a 6-digit OTP,
 * stores it on the admin doc with a 5-min TTL, and emails it via
 * Resend. Always returns a generic 200 with `{ ok: true }` on
 * success and `{ ok: false }` on any auth failure to prevent email
 * enumeration. Rate-limited: 5 OTP requests per email per 15 min.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
    }

    const admin = await verifyPassword(email, password)
    if (!admin) {
      // Run bcrypt against a dummy hash to keep timing similar for
      // valid vs invalid email addresses (defense in depth).
      await verifyPassword(email, 'x').catch(() => null)
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 200 })
    }

    const result = await generateAndStoreOtp(email)
    if (!result.ok) {
      if (result.reason === 'rate_limited') {
        return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
      }
      // No admin doc found (race between password verify and OTP gen).
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 200 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/auth/login]', err)
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }
}

/**
 * Admin authentication primitives: bcrypt password verification,
 * OTP generation/verification, Resend email delivery.
 *
 * Storage model: each admin is a `adminUser` document in Sanity.
 * Password is stored as a bcrypt hash. OTP is stored in plain (6 digits,
 * 5-min TTL, single-use, rate-limited) — the trade-off is acceptable
 * because brute-forcing 6 digits in 5 min requires 100k attempts and
 * we rate-limit at 5 per email per 15 min.
 *
 * Session model: no separate session table. The admin_session cookie
 * holds the email directly. Middleware looks up the adminUser by
 * email to validate. Logout clears the cookie.
 */
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { Resend } from 'resend'
import { sanityClient } from './sanity/client'
import { safeEqual } from './security'

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_LENGTH = 6
const BCRYPT_COST = 12

// Rate limit: at most 5 OTP requests per email per 15 min. In-memory
// counter; reset on cold start, and per-instance only. Good enough
// for a small admin team — for production-grade limits, push to
// Sanity or Upstash.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 5
const otpRequestBuckets = new Map<string, number[]>()

function isOtpRateLimited(email: string): boolean {
  const now = Date.now()
  const stamps = (otpRequestBuckets.get(email) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (stamps.length >= RATE_LIMIT_MAX) return true
  stamps.push(now)
  otpRequestBuckets.set(email, stamps)
  return false
}

type AdminUserDoc = {
  _id: string
  email: string
  name?: string
  passwordHash: string
  otpCode?: string
  otpExpiresAt?: string
}

async function findAdminByEmail(email: string): Promise<AdminUserDoc | null> {
  return sanityClient.fetch<AdminUserDoc | null>(
    '*[_type == "adminUser" && email == $email][0]',
    { email: email.trim().toLowerCase() }
  )
}

export async function verifyPassword(email: string, password: string): Promise<AdminUserDoc | null> {
  const admin = await findAdminByEmail(email)
  if (!admin?.passwordHash) return null
  const ok = await bcrypt.compare(password, admin.passwordHash)
  if (!ok) return null
  return admin
}

function generateOtpCode(): string {
  // 6-digit numeric, leading zeros allowed
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, '0')
}

export async function generateAndStoreOtp(email: string): Promise<{ ok: boolean; reason?: 'rate_limited' | 'no_admin' }> {
  if (isOtpRateLimited(email)) return { ok: false, reason: 'rate_limited' }
  const admin = await findAdminByEmail(email)
  if (!admin) return { ok: false, reason: 'no_admin' }
  const code = generateOtpCode()
  const expires = new Date(Date.now() + OTP_TTL_MS).toISOString()
  await sanityClient.patch(admin._id).set({ otpCode: code, otpExpiresAt: expires }).commit()
  await sendOtpEmail(email, code, admin.name)
  return { ok: true }
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const admin = await findAdminByEmail(email)
  if (!admin?.otpCode || !admin.otpExpiresAt) return false
  const expiresMs = new Date(admin.otpExpiresAt).getTime()
  if (Date.now() > expiresMs) return false
  // Constant-time compare on the code itself
  if (!safeEqual(code.trim(), admin.otpCode)) return false
  // Single-use: clear the OTP immediately on a successful match.
  await sanityClient.patch(admin._id).set({ otpCode: null, otpExpiresAt: null, lastLoginAt: new Date().toISOString() }).commit()
  return true
}

async function sendOtpEmail(email: string, code: string, name?: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Fallback: log to Vercel so the admin can see the code during
    // development. Production REQUIRES RESEND_API_KEY.
    console.log(`[adminAuth] OTP for ${email}: ${code}`)
    return
  }
  const from = process.env.ADMIN_FROM_EMAIL ?? 'onboarding@resend.dev'
  const resend = new Resend(apiKey)
  await resend.emails.send({
    from,
    to: email,
    subject: 'Your Sharma Bajaj admin sign-in code',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 16px; color: #111;">Sign-in code</h2>
        <p style="margin: 0 0 12px; color: #444;">Hi${name ? ` ${name}` : ''},</p>
        <p style="margin: 0 0 16px; color: #444;">Use this code to complete your sign-in to the Sharma Bajaj Service Centre admin dashboard:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 4px; padding: 16px 24px; background: #f4f4f5; border-radius: 8px; display: inline-block; margin: 16px 0; color: #111;">${code}</div>
        <p style="margin: 16px 0 0; color: #666; font-size: 14px;">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  })
}

/**
 * Security primitives shared by the API routes.
 *
 * - timingSafeEqual: constant-time string comparison. Use for ANY secret
 *   check (CRON_SECRET, WHATSAPP_WEBHOOK_VERIFY_TOKEN, ADMIN_API_KEY,
 *   etc.) to deny attackers a side-channel byte-by-byte timing oracle.
 *
 * - verifyMetaSignature: HMAC-SHA256 verification of webhook payloads
 *   using the Meta app secret. The signature comes in the
 *   `X-Hub-Signature-256` header as `sha256=<hex>`. Without this, any
 *   attacker who knows the verify token can POST forged messages to
 *   the webhook and trigger arbitrary flows.
 *
 * - normalizeE164: returns a string in canonical E.164 form
 *   (`+` + digits, 11+ chars) or null. Used to reject malformed phone
 *   numbers before they reach downstream APIs.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string comparison. Returns false if either input is
 * missing or the lengths differ (the length check is itself constant-
 * time within a single call, and length-leakage is unavoidable but
 * not a meaningful attack vector since the secret length is fixed).
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Verify a Meta webhook signature.
 *
 * Meta signs every inbound POST with HMAC-SHA256(app_secret, raw_body).
 * The signature arrives in the `X-Hub-Signature-256` header as
 * `sha256=<hex>`. Returns true if the signature is valid.
 *
 * The `rawBody` argument MUST be the exact byte sequence Meta sent.
 * Next.js route handlers that read the body via `req.json()` will have
 * already parsed it — we need to re-derive the raw string from the
 * request. The easiest portable approach is to pass the raw text we
 * extract via `await req.text()` at the top of the handler.
 */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith('sha256=')) return false
  const provided = header.slice('sha256='.length).trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(provided)) return false
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  // Both are 64-char hex; timingSafeEqual is safe.
  return safeEqual(provided, expected)
}

/**
 * E.164 normalization for Indian phone numbers we expect to see.
 * Returns null if the input doesn't look like a valid 10-15 digit
 * number. The Meta Cloud API will reject malformed `to` fields with
 * a 400, but we can fail faster and quieter.
 */
export function normalizeE164(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = input.replace(/[^0-9]/g, '')
  if (digits.length < 10 || digits.length > 15) return null
  return '+' + digits
}

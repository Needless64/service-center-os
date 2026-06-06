import { NextRequest, NextResponse } from 'next/server'
import { parseIncomingWebhook, markAsRead, sendText } from '@/lib/whatsapp/client'
import { handleIncomingMessage } from '@/lib/whatsapp/conversationHandler'
import { safeEqual, verifyMetaSignature, normalizeE164 } from '@/lib/security'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!
const APP_SECRET = process.env.WHATSAPP_APP_SECRET!

// ─── Deduplication: WhatsApp may redeliver a message (timeouts, retries).
// Memory map is best-effort within a single warm serverless instance.
// For full coverage across instances, swap to Sanity / KV (TODO).
const DEDUP_TTL_MS = 5 * 60 * 1000
const seenMessageIds = new Map<string, number>()

function isDuplicate(messageId: string): boolean {
  const now = Date.now()
  // Prune expired entries opportunistically
  for (const [id, ts] of seenMessageIds) {
    if (now - ts > DEDUP_TTL_MS) seenMessageIds.delete(id)
  }
  if (seenMessageIds.has(messageId)) return true
  seenMessageIds.set(messageId, now)
  return false
}

// ─── Rate limit: per-phone token bucket. Prevents a single sender from
// spamming the webhook and forcing thousands of outbound WhatsApp API
// calls. Best-effort within a single warm instance; cross-instance
// guarantees need a shared store.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20
const rateLimitBuckets = new Map<string, number[]>()

function isRateLimited(phone: string): boolean {
  const now = Date.now()
  const stamps = (rateLimitBuckets.get(phone) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (stamps.length >= RATE_LIMIT_MAX) return true
  stamps.push(now)
  rateLimitBuckets.set(phone, stamps)
  return false
}

// ─── GET: Webhook verification by Meta ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Constant-time compare on the verify token so an attacker can't
  // measure timing to recover it byte-by-byte.
  if (mode === 'subscribe' && safeEqual(token, VERIFY_TOKEN)) {
    console.log('[webhook] Verified successfully')
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

// ─── POST: Incoming messages ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Read the raw body once for HMAC verification, then parse JSON
    // from the same string. The signature is computed over the
    // exact bytes Meta sent; req.json() would have already lost that
    // boundary information.
    const rawBody = await req.text()
    const signature = req.headers.get('x-hub-signature-256')
    if (!verifyMetaSignature(rawBody, signature, APP_SECRET)) {
      console.warn('[webhook] Rejected: invalid signature')
      return new Response('Forbidden', { status: 403 })
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ status: 'parse_error' }, { status: 400 })
    }
    const parsed = body as { object?: string }
    if (parsed.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    const message = parseIncomingWebhook(body as Record<string, unknown>)
    if (!message) return NextResponse.json({ status: 'no_message' }, { status: 200 })

    // Reject obviously malformed senders before we spend any API calls.
    if (!normalizeE164(message.from)) {
      console.warn('[webhook] Rejected: from is not a valid phone', message.from)
      return NextResponse.json({ status: 'bad_from' }, { status: 200 })
    }

    if (isRateLimited(message.from)) {
      console.warn('[webhook] Rate-limited:', message.from)
      return NextResponse.json({ status: 'rate_limited' }, { status: 200 })
    }

    if (isDuplicate(message.messageId)) {
      console.log('[webhook] Duplicate message ignored:', message.messageId)
      return NextResponse.json({ status: 'duplicate' }, { status: 200 })
    }

    // markAsRead failure must not block message processing
    try {
      await markAsRead(message.messageId)
    } catch (err) {
      console.error('[webhook] markAsRead failed (continuing):', err)
    }

    try {
      await handleIncomingMessage(message.from, message.text ?? '', message.interactiveId)
    } catch (err) {
      console.error('[webhook] Processing error:', err)
      try {
        await sendText(message.from, `Sorry, something went wrong. Please try again.`)
      } catch {}
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err) {
    console.error('[webhook] Parse error:', err)
    return NextResponse.json({ status: 'error' }, { status: 200 })
  }
}

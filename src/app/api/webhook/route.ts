import { NextRequest, NextResponse } from 'next/server'
import { parseIncomingWebhook, markAsRead } from '@/lib/whatsapp/client'
import { handleIncomingMessage } from '@/lib/whatsapp/conversationHandler'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!

// ─── GET: Webhook verification by Meta ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[webhook] Verified successfully')
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

// ─── POST: Incoming messages ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate it's from WhatsApp
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    const message = parseIncomingWebhook(body)
    if (!message) return NextResponse.json({ status: 'no_message' }, { status: 200 })

    // Always respond 200 immediately — process async
    void (async () => {
      try {
        await markAsRead(message.messageId)
        await handleIncomingMessage(message.from, message.text ?? '', message.interactiveId)
      } catch (err) {
        console.error('[webhook] Processing error:', err)
        // Send fallback so user isn't left hanging
        try {
          const { sendText } = await import('@/lib/whatsapp/client')
          await sendText(message.from, `Sorry, something went wrong. Please try again.`)
        } catch {}
      }
    })()

    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err) {
    console.error('[webhook] Parse error:', err)
    return NextResponse.json({ status: 'error' }, { status: 200 })
  }
}

import { normalizePhone } from '../utils'

const WA_API_URL = `https://graph.facebook.com/v21.0`
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!

async function post(endpoint: string, body: object) {
  const res = await fetch(`${WA_API_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('[WA] API error:', res.status, err)
    throw new Error(`WhatsApp API ${res.status}: ${err}`)
  }
  return res.json()
}

/**
 * Send a pre-approved template message.
 *
 * Throws on failure with a `code` property carrying the Meta error code so
 * callers can decide whether to fall back to freeform (e.g. template not
 * approved yet, or window is closed and a different template would be
 * required). Codes we care about:
 *
 *   132001 — Template name does not exist in this WABA
 *   131047 — Re-engagement message required (no 24h window, need a template)
 *   131026 — User has not opened the conversation in >24h
 *   131000  generic — see message
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  bodyVariables: string[] = []
) {
  return post(`${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: bodyVariables.length
        ? [
            {
              type: 'body',
              parameters: bodyVariables.map((v) => ({ type: 'text', text: String(v ?? '') })),
            },
          ]
        : [],
    },
  })
}

/**
 * Best-effort wrapper used by the cron / admin notification paths.
 * Tries the template first; on the typical "not approved / not allowed"
 * errors, falls back to the legacy freeform text. This keeps the bot
 * working in the window between cron firing and Meta approving the
 * templates, and after approval automatically switches to the proactive
 * template path.
 *
 * Logs the fallback so you can see when it's still being used.
 */
export async function sendTemplateWithFallback(
  to: string,
  templateName: string,
  fallbackText: string,
  bodyVariables: string[] = []
) {
  try {
    return await sendTemplate(to, templateName, 'en', bodyVariables)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Codes that mean "template won't work, use freeform": 132001, 131047, 131026
    const fallbackCodes = ['132001', '131047', '131026', '131000']
    const shouldFallback = fallbackCodes.some((c) => msg.includes(c))
    if (shouldFallback) {
      console.warn(`[WA] template ${templateName} failed (${msg.split(':')[1]?.trim() ?? 'unknown'}); falling back to freeform`)
      return sendText(to, fallbackText)
    }
    throw err
  }
}

/**
 * Tries each template name in order; the first one Meta accepts wins.
 * Use this when you have multiple versions of a template (e.g. v5 with
 * shorter copy, v6 with a polished line) and want to prefer the latest
 * once it's approved while gracefully using the older one in the
 * meantime. Same "not approved" codes as the single-template fallback
 * move on to the next candidate. If every template fails, returns the
 * freeform text.
 */
export async function sendTemplateTryMultiple(
  to: string,
  templateNames: string[],
  fallbackText: string,
  bodyVariables: string[] = []
) {
  let lastErr: unknown = null
  for (const name of templateNames) {
    try {
      return await sendTemplate(to, name, 'en', bodyVariables)
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const fallbackCodes = ['132001', '131047', '131026', '131000']
      if (!fallbackCodes.some((c) => msg.includes(c))) throw err
      console.warn(`[WA] template ${name} not available; trying next candidate`)
    }
  }
  console.warn(`[WA] all ${templateNames.length} template candidates failed; falling back to freeform`)
  return sendText(to, fallbackText)
}

// ─── Send plain text ─────────────────────────────────────────────────────────

export async function sendText(to: string, text: string) {
  return post(`${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text, preview_url: false },
  })
}

// ─── Send interactive list (menu) ────────────────────────────────────────────

export type ListRow = { id: string; title: string; description?: string }
export type ListSection = { title: string; rows: ListRow[] }

export async function sendList(
  to: string,
  body: string,
  buttonLabel: string,
  sections: ListSection[]
) {
  return post(`${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: { button: buttonLabel, sections },
    },
  })
}

// ─── Send interactive reply buttons ─────────────────────────────────────────

export type ReplyButton = { id: string; title: string }

// Only quick-reply buttons are supported in v21.0 button messages.
// `cta_url` with `tel:` schemes was rejected at runtime. The phone-number
// CTA path is not exposed by the Cloud API for button messages, so we
// encode the workshop phone as a plain text line in the body where the
// customer can long-press to call.
export type InteractiveButton = { id: string; title: string }

export async function sendButtons(to: string, body: string, buttons: InteractiveButton[]) {
  return post(`${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
      },
    },
  })
}

// ─── Mark as read ────────────────────────────────────────────────────────────

export async function markAsRead(messageId: string) {
  return post(`${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  })
}

// ─── Extract incoming message data ──────────────────────────────────────────

export type IncomingMessage = {
  from: string
  messageId: string
  type: 'text' | 'interactive' | 'other'
  text?: string
  interactiveId?: string
  interactiveTitle?: string
}

export function parseIncomingWebhook(body: Record<string, unknown>): IncomingMessage | null {
  try {
    const entry = (body.entry as unknown[])?.[0] as Record<string, unknown>
    const changes = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
    const value = changes?.value as Record<string, unknown>
    const messages = value?.messages as unknown[]
    if (!messages?.length) return null

    const msg = messages[0] as Record<string, unknown>
    const from = normalizePhone(msg.from as string)
    const messageId = msg.id as string
    const type = msg.type as string

    if (type === 'text') {
      const textObj = msg.text as Record<string, unknown>
      return { from, messageId, type: 'text', text: textObj?.body as string }
    }

    if (type === 'interactive') {
      const interactive = msg.interactive as Record<string, unknown>
      const reply = (interactive?.button_reply ?? interactive?.list_reply) as Record<string, unknown>
      return {
        from,
        messageId,
        type: 'interactive',
        interactiveId: reply?.id as string,
        interactiveTitle: reply?.title as string,
        text: reply?.title as string,
      }
    }

    return { from, messageId, type: 'other' }
  } catch {
    return null
  }
}

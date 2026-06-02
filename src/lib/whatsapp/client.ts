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

export async function sendButtons(to: string, body: string, buttons: ReplyButton[]) {
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
    const from = msg.from as string
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

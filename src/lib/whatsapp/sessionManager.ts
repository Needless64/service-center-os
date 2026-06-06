// Sanity-backed session store — survives across serverless invocations

import { sanityClient } from '../sanity/client'

export type ConversationState =
  | 'IDLE'
  | 'SELECTING_SERVICE_TYPE'
  | 'COLLECTING_VEHICLE_NUMBER'
  | 'COLLECTING_CUSTOMER_NAME'
  | 'SELECTING_SLOT_DATE'
  | 'SELECTING_SLOT_TIME'
  | 'CONFIRMING_BOOKING'
  | 'AWAITING_RESCHEDULE_DATE'
  | 'AWAITING_RESCHEDULE_TIME'
  | 'BOOKING_CONFIRMED'

export type SessionData = {
  state: ConversationState
  serviceType?: string
  vehicleNumber?: string
  vehicleModel?: string
  manufacturer?: string
  notes?: string
  customerName?: string
  existingCustomerId?: string
  isReturningCustomer?: boolean
  selectedDate?: string
  selectedTime?: string
  availableDates?: string[]
  activeBookingId?: string
  activeBookingDocId?: string
  onboardedAt?: number
  lastActivity: number
}

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

// ─── Sanity fetch ────────────────────────────────────────────────────────────

async function fetchSession(phone: string): Promise<SessionData | null> {
  try {
    const doc = await sanityClient.fetch(
      `*[_type == "whatsappSession" && phone == $phone][0]`,
      { phone }
    )
    if (!doc) return null
    if (Date.now() - doc.lastActivity > SESSION_TTL_MS) return null
    return doc.data as SessionData
  } catch {
    return null
  }
}

async function saveSession(phone: string, data: SessionData): Promise<void> {
  try {
    const existing = await sanityClient.fetch(
      `*[_type == "whatsappSession" && phone == $phone][0]._id`,
      { phone }
    )
    if (existing) {
      await sanityClient.patch(existing).set({ data, lastActivity: data.lastActivity }).commit()
    } else {
      await sanityClient.create({ _type: 'whatsappSession', phone, data, lastActivity: data.lastActivity })
    }
  } catch {}
}

async function deleteSession(phone: string): Promise<void> {
  try {
    const id = await sanityClient.fetch(
      `*[_type == "whatsappSession" && phone == $phone][0]._id`,
      { phone }
    )
    if (id) await sanityClient.delete(id)
  } catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getSession(phone: string): Promise<SessionData> {
  const existing = await fetchSession(phone)
  if (existing) return existing
  return { state: 'IDLE', lastActivity: Date.now() }
}

export async function updateSession(phone: string, updates: Partial<SessionData>): Promise<void> {
  const current = await getSession(phone)
  const updated = { ...current, ...updates, lastActivity: Date.now() }
  await saveSession(phone, updated)
}

export async function resetSession(phone: string): Promise<void> {
  await deleteSession(phone)
}

// True if we've already shown the first-time onboarding message to
// this phone. The flag is stored in the session so it survives across
// messages but gets reset whenever the user explicitly asks for help
// (resetSession clears the whole doc).
export async function wasOnboarded(phone: string): Promise<boolean> {
  const existing = await fetchSession(phone)
  return Boolean(existing?.onboardedAt)
}

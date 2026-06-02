// In-memory session store. Replace with Redis for multi-instance production.

export type ConversationState =
  | 'IDLE'
  | 'SELECTING_SERVICE_TYPE'
  | 'COLLECTING_VEHICLE_NUMBER'
  | 'COLLECTING_VEHICLE_MODEL'
  | 'COLLECTING_MANUFACTURER'
  | 'COLLECTING_NOTES'
  | 'COLLECTING_CUSTOMER_NAME'
  | 'SELECTING_SLOT_DATE'
  | 'SELECTING_SLOT_TIME'
  | 'CONFIRMING_BOOKING'
  | 'AWAITING_RESCHEDULE_DATE'
  | 'AWAITING_RESCHEDULE_TIME'
  | 'BOOKING_CONFIRMED'

export type SessionData = {
  state: ConversationState
  // Booking data being collected
  serviceType?: string
  vehicleNumber?: string
  vehicleModel?: string
  manufacturer?: string
  notes?: string
  customerName?: string
  // Customer / booking refs
  existingCustomerId?: string
  isReturningCustomer?: boolean
  // Slot selection
  selectedDate?: string
  selectedTime?: string
  availableDates?: string[]
  slotsForDate?: { time: string; slotId: string; spotsLeft: number }[]
  // Active booking for reschedule
  activeBookingId?: string
  activeBookingDocId?: string
  lastActivity: number
}

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

const sessions = new Map<string, SessionData>()

export function getSession(phone: string): SessionData {
  const existing = sessions.get(phone)
  if (existing && Date.now() - existing.lastActivity < SESSION_TTL_MS) {
    return existing
  }
  const fresh: SessionData = { state: 'IDLE', lastActivity: Date.now() }
  sessions.set(phone, fresh)
  return fresh
}

export function updateSession(phone: string, updates: Partial<SessionData>) {
  const session = getSession(phone)
  Object.assign(session, updates, { lastActivity: Date.now() })
  sessions.set(phone, session)
}

export function resetSession(phone: string) {
  sessions.set(phone, { state: 'IDLE', lastActivity: Date.now() })
}

// Clean up expired sessions every 15 minutes
setInterval(() => {
  const now = Date.now()
  for (const [phone, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      sessions.delete(phone)
    }
  }
}, 15 * 60 * 1000)

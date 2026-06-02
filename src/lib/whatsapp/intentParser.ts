export type Intent =
  | 'BOOK_SERVICE'
  | 'CHECK_STATUS'
  | 'CANCEL_BOOKING'
  | 'RESCHEDULE_BOOKING'
  | 'CONFIRM_YES'
  | 'CONFIRM_NO'
  | 'HELP'
  | 'UNKNOWN'

const BOOKING_KEYWORDS = [
  'book', 'booking', 'service', 'appointment', 'repair', 'fix', 'diagnose',
  'breakdown', 'emergency', 'servicing', 'maintenance', 'checkup', 'check-up',
  'my bike', 'my car', 'my vehicle', 'my scooter', 'schedule', 'want service',
  'need service', 'book service', 'service center', 'centre',
]

const STATUS_KEYWORDS = [
  'status', 'track', 'tracking', 'where', 'ready', 'done', 'complete',
  'my booking', 'my vehicle', 'update', 'progress', 'service status',
  'booking status', 'vehicle status', 'when', 'how long',
]

const CANCEL_KEYWORDS = ['cancel', 'cancellation', 'not coming', "won't come", 'abort']

const RESCHEDULE_KEYWORDS = ['reschedule', 'change', 'postpone', 'move', 'shift', 'different day', 'another day']

const YES_KEYWORDS = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'sure', 'correct', 'right', 'perfect', '1', 'y', 'fine']

const NO_KEYWORDS = ['no', 'nope', 'nah', 'cancel', '2', 'n', 'not']

const HELP_KEYWORDS = ['help', 'hi', 'hello', 'hey', 'start', 'menu', 'options', 'hii', 'helo']

export function parseIntent(text: string): Intent {
  const lower = text.trim().toLowerCase()

  if (HELP_KEYWORDS.some((k) => lower === k || lower.startsWith(k + ' '))) return 'HELP'
  if (CANCEL_KEYWORDS.some((k) => lower.includes(k))) return 'CANCEL_BOOKING'
  if (RESCHEDULE_KEYWORDS.some((k) => lower.includes(k))) return 'RESCHEDULE_BOOKING'
  if (STATUS_KEYWORDS.some((k) => lower.includes(k))) return 'CHECK_STATUS'
  if (BOOKING_KEYWORDS.some((k) => lower.includes(k))) return 'BOOK_SERVICE'
  if (YES_KEYWORDS.includes(lower)) return 'CONFIRM_YES'
  if (NO_KEYWORDS.includes(lower)) return 'CONFIRM_NO'

  return 'UNKNOWN'
}

// ─── Service type label helper ────────────────────────────────────────────────

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  free_service: 'Free Service',
  paid_service: 'General Paid Service',
  repair_diagnosis: 'Repair / Diagnosis',
  emergency: 'Emergency',
  other: 'Other',
}

export function formatServiceType(value: string): string {
  return SERVICE_TYPE_LABELS[value] ?? value
}

export const STATUS_EMOJI: Record<string, string> = {
  booked: '📅',
  received: '🔑',
  completed: '✅',
  cancelled: '❌',
  no_show: '👻',
}

export const STATUS_LABELS: Record<string, string> = {
  booked: 'Appointment Confirmed',
  received: 'Vehicle Received at Workshop',
  completed: 'Service Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

import { sendText, sendButtons, sendTemplateWithFallback, sendTemplateTryMultiple } from '../client'
import type { SanityBooking } from '../../sanity/queries'
import { format, differenceInHours, differenceInMinutes } from 'date-fns'
import { formatServiceType } from '../intentParser'
import { getAgencyPhone } from '../env'

export function buildReminderMessage(booking: SanityBooking, type: '24h' | '3h' | '30m'): string {
  const dateFormatted = format(new Date(`${booking.scheduledDate}T12:00:00+05:30`), 'EEE, d MMM yyyy')
  const timeFormatted = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')
  const serviceLabel = formatServiceType(booking.serviceType)

  const openers: Record<string, string> = {
    '24h': `⏰ *Reminder: Your service appointment is tomorrow!*`,
    '3h': `🔔 *Reminder: Your appointment is in 3 hours!*`,
    '30m': `🚨 *Reminder: Your appointment is in 30 minutes!*`,
  }

  return [
    openers[type],
    ``,
    `🎫 Booking: *${booking.bookingId}*`,
    `🚗 Vehicle: ${booking.vehicleNumber} (${booking.vehicleModel ?? ''})`,
    `🔧 Service: ${serviceLabel}`,
    `📅 Date: ${dateFormatted}`,
    `⏰ Time: ${timeFormatted}`,
    ``,
    `Reply *confirm* to confirm, *reschedule* to reschedule, or *cancel* to cancel.`,
  ].join('\n')
}

export async function sendReminder(booking: SanityBooking, customerPhone: string, type: '24h' | '3h' | '30m') {
  const dateFormatted = format(new Date(`${booking.scheduledDate}T12:00:00+05:30`), 'EEE, d MMM yyyy')
  const timeFormatted = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')
  const customerName = (booking.customer as unknown as { name?: string })?.name ?? 'Customer'

  // Map reminder type → template name + variable slots. The 24h template has
  // 3 vars (name, date, time); the 3h template has 2 (name, time); the 30m
  // template has 1 (name). The body variables MUST match the template's
  // declared variable positions exactly or Meta will reject the send.
  const TEMPLATE_VARS: Record<'24h' | '3h' | '30m', { name: string; vars: string[] }> = {
    '24h': { name: 'svc_reminder_24h_v5', vars: [customerName, dateFormatted, timeFormatted] },
    '3h':  { name: 'svc_reminder_3h_v5',  vars: [customerName, timeFormatted] },
    '30m': { name: 'svc_reminder_30m',     vars: [customerName] },
  }
  const tpl = TEMPLATE_VARS[type]
  const fallback = buildReminderMessage(booking, type)

  // 30m reminder: send the template, then follow up with a Call Workshop
  // phone-button so the customer can reach a human. The follow-up is a
  // freeform interactive send — allowed because the template just opened
  // a 24h customer-service window. The agency phone comes from the
  // AGENCY_PHONE_NUMBER env var (set in Vercel + GitHub Actions).
  if (type === '30m') {
    const sendResult = await sendTemplateWithFallback(customerPhone, tpl.name, fallback, tpl.vars)
    const phoneNumber = getAgencyPhone()
    if (phoneNumber) {
      await sendButtons(customerPhone, 'Need to talk to us? Tap below to call our workshop directly.', [
        { type: 'phone_number', phoneNumber, title: '📞 Call Workshop' },
      ])
    } else {
      await sendText(customerPhone, 'Need to talk to us? Just reply *help* and we will guide you.')
    }
    return sendResult
  }

  return sendTemplateWithFallback(customerPhone, tpl.name, fallback, tpl.vars)
}

export async function sendReadyForPickupNotification(booking: SanityBooking, customerPhone: string) {
  const customerName = (booking.customer as unknown as { name?: string })?.name ?? 'Customer'
  const fallback = [
    `🎉 *Great news! Your vehicle is ready for pickup!*`,
    ``,
    `🎫 Booking: *${booking.bookingId}*`,
    `🚗 Vehicle: ${booking.vehicleNumber}`,
    `✅ Status: *Ready for Pickup*`,
    ``,
    `Please visit us at your earliest convenience to collect your vehicle.`,
    ``,
    `Questions? Reply to this message or call us directly. 🙏`,
  ].join('\n')

  return sendTemplateTryMultiple(
    customerPhone,
    // Prefer the polished v6 copy; fall back to v5 (or the freeform) if Meta
    // hasn't approved v6 yet. Both templates share the same 3-var shape
    // (name, vehicle, bookingId) so the bodyVariables list is identical.
    ['vehicle_ready_v6', 'vehicle_ready_v5'],
    fallback,
    [customerName, booking.vehicleNumber, booking.bookingId]
  )
}

export async function sendDeliveryConfirmation(booking: SanityBooking, customerPhone: string) {
  const customerName = (booking.customer as unknown as { name?: string })?.name ?? 'Customer'
  const fallback = [
    `✨ *Thank you for trusting us with your vehicle!*`,
    ``,
    `Your vehicle has been delivered successfully.`,
    `🎫 Booking: *${booking.bookingId}*`,
    booking.finalCost ? `💰 Final Bill: ₹${booking.finalCost}` : '',
    ``,
    `We hope you're happy with our service! 😊`,
    ``,
    `To book your next service, just reply *book*. See you again!`,
  ]
    .filter(Boolean)
    .join('\n')

  // svc_complete_v5 takes 4 vars (name, vehicle, bookingId, total). If final
  // cost is missing we pass an empty string — Meta allows that.
  return sendTemplateWithFallback(
    customerPhone,
    'svc_complete_v5',
    fallback,
    [customerName, booking.vehicleNumber, booking.bookingId, booking.finalCost ? String(booking.finalCost) : '']
  )
}

// ─── Determine which reminders need sending ──────────────────────────────────

export function shouldSendReminder(
  booking: SanityBooking,
  type: '24h' | '3h' | '30m',
  now: Date
): boolean {
  if (booking.status !== 'booked') return false

  const alreadySent = {
    '24h': booking.reminderSent24h,
    '3h': booking.reminderSent3h,
    '30m': booking.reminderSent30m,
  }[type]

  if (alreadySent) return false

  const appointmentDateTime = new Date(`${booking.scheduledDate}T${booking.scheduledTime}:00+05:30`)
  const hoursUntil = differenceInHours(appointmentDateTime, now)
  const minutesUntil = differenceInMinutes(appointmentDateTime, now)

  if (type === '24h') return hoursUntil >= 20 && hoursUntil <= 26
  if (type === '3h') return hoursUntil >= 2 && hoursUntil <= 4
  if (type === '30m') return minutesUntil >= 20 && minutesUntil <= 40

  return false
}

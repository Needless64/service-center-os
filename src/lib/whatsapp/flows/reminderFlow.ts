import { sendText, sendTemplateWithFallback } from '../client'
import type { SanityBooking } from '../../sanity/queries'
import { format } from 'date-fns'
import { formatServiceType } from '../intentParser'
import { getAgencyPhone } from '../env'

export function buildReminderMessage(booking: SanityBooking): string {
  const dateFormatted = format(new Date(`${booking.scheduledDate}T12:00:00+05:30`), 'EEE, d MMM yyyy')
  const timeFormatted = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')
  const serviceLabel = formatServiceType(booking.serviceType)

  return [
    `⏰ *Reminder: Your service appointment is in about 1 hour!*`,
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

// Single 1h-before reminder. The cron route no longer branches on
// 24h/3h/30m — the underlying query pre-filters un-reminded bookings
// and the window check in the route ensures this fires once per ticket.
export async function sendReminder(booking: SanityBooking, customerPhone: string, _type: '1h' = '1h') {
  const dateFormatted = format(new Date(`${booking.scheduledDate}T12:00:00+05:30`), 'EEE, d MMM yyyy')
  const timeFormatted = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')
  const customerName = (booking.customer as unknown as { name?: string })?.name ?? 'Customer'

  // Use the 3h template (still approved, 2 vars: name, time) as a
  // stand-in until a dedicated 1h template is created and approved.
  // The 30m template only takes the customer name — too thin for an
  // "about 1 hour" reminder, so 3h is the closer match in content.
  const templateName = 'svc_reminder_3h_v5'
  const templateVars = [customerName, timeFormatted]
  const fallback = buildReminderMessage(booking)

  const sendResult = await sendTemplateWithFallback(customerPhone, templateName, fallback, templateVars)

  // Follow up with the workshop phone number (plain text — see client.ts
  // note on cta_url + tel: rejection). The cron route also marks
  // reminderSent24h/3h/30m all true after a successful send, so the
  // booking will be skipped on subsequent cron passes.
  const phoneNumber = getAgencyPhone()
  if (phoneNumber) {
    await sendText(
      customerPhone,
      `Need to talk to us? Just long-press this number to call our workshop:\n\n📞 ${phoneNumber}`
    )
  } else {
    await sendText(customerPhone, 'Need to talk to us? Just reply *help* and we will guide you.')
  }
  return sendResult
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

  // Prefer v6, fall back to v5.
  const { sendTemplateTryMultiple } = await import('../client')
  return sendTemplateTryMultiple(
    customerPhone,
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

  return sendTemplateWithFallback(
    customerPhone,
    'svc_complete_v5',
    fallback,
    [customerName, booking.vehicleNumber, booking.bookingId, booking.finalCost ? String(booking.finalCost) : '']
  )
}

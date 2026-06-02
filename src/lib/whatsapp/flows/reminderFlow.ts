import { sendText, sendButtons } from '../client'
import type { SanityBooking } from '../../sanity/queries'
import { format, differenceInHours, differenceInMinutes } from 'date-fns'
import { formatServiceType } from '../intentParser'

export function buildReminderMessage(booking: SanityBooking, type: '24h' | '3h' | '30m'): string {
  const dateFormatted = format(new Date(booking.scheduledDate), 'EEE, d MMM yyyy')
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
  const message = buildReminderMessage(booking, type)
  await sendText(customerPhone, message)
}

export async function sendReadyForPickupNotification(booking: SanityBooking, customerPhone: string) {
  const message = [
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

  await sendText(customerPhone, message)
}

export async function sendDeliveryConfirmation(booking: SanityBooking, customerPhone: string) {
  const message = [
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

  await sendText(customerPhone, message)
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

  const appointmentDateTime = new Date(`${booking.scheduledDate}T${booking.scheduledTime}:00`)
  const hoursUntil = differenceInHours(appointmentDateTime, now)
  const minutesUntil = differenceInMinutes(appointmentDateTime, now)

  if (type === '24h') return hoursUntil >= 20 && hoursUntil <= 26
  if (type === '3h') return hoursUntil >= 2 && hoursUntil <= 4
  if (type === '30m') return minutesUntil >= 20 && minutesUntil <= 40

  return false
}

import { sendText, sendList, sendButtons } from '../client'
import { getCustomerByPhone, getLatestActiveBooking, getSlot } from '../../sanity/queries'
import { markBookingConfirmed, rescheduleBooking } from '../../sanity/mutations'
import { getSession, updateSession, resetSession } from '../sessionManager'
import { getAvailableDays } from '../slotHelper'
import { format, differenceInMinutes } from 'date-fns'
import { RESCHEDULE_LOCK_MINUTES } from '../locks'
import { getAgencyPhone } from '../env'

function minutesUntilAppointment(scheduledDate: string, scheduledTime: string): number {
  const appointmentDateTime = new Date(`${scheduledDate}T${scheduledTime}:00+05:30`)
  return differenceInMinutes(appointmentDateTime, new Date())
}

// "Customer can't proceed online — please call us" reply. Includes the
// agency phone number in the body so the customer can long-press to dial.
// (The Cloud API v21.0 doesn't support tap-to-call buttons on interactive
// messages, so we put the number in the text instead.)
async function sendLockErrorWithCall(phone: string, message: string) {
  const phoneNumber = getAgencyPhone()
  if (phoneNumber) {
    await sendText(phone, `${message}\n\n📞 Call us: ${phoneNumber}`)
  } else {
    await sendText(phone, message)
  }
}

// ─── Confirm ────────────────────────────────────────────────────────────────

export async function handleRemindConfirm(phone: string) {
  const customer = await getCustomerByPhone(phone)
  if (!customer) { await sendText(phone, 'No active booking found.'); return }
  const booking = await getLatestActiveBooking(customer._id)
  if (!booking) { await sendText(phone, 'No active booking found.'); return }

  if (booking.confirmedAt) {
    await sendText(phone, `✅ Already confirmed. See you on ${booking.scheduledDate} at ${booking.scheduledTime}!`)
    return
  }

  await markBookingConfirmed(booking._id)
  const timeFormatted = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')
  const dateFormatted = format(new Date(`${booking.scheduledDate}T12:00:00+05:30`), 'EEE, d MMM')
  await sendText(
    phone,
    `✅ Confirmed! Your *${formatServiceLabel(booking.serviceType)}* for *${booking.vehicleNumber}* is locked in.\n\n📅 ${dateFormatted} @ ${timeFormatted}\n\nSee you then! 🙏`
  )
}

function formatServiceLabel(value: string): string {
  const labels: Record<string, string> = {
    free_service: 'Free Service',
    paid_service: 'General Paid Service',
    repair_diagnosis: 'Repair / Diagnosis',
    emergency: 'Emergency',
    other: 'Service',
  }
  return labels[value] ?? 'Service'
}

// ─── Reschedule (entry, dispatched from conversation handler) ───────────────

export async function startReschedule(phone: string) {
  const customer = await getCustomerByPhone(phone)
  if (!customer) { await sendText(phone, 'No booking found.'); return }
  const booking = await getLatestActiveBooking(customer._id)
  if (!booking) { await sendText(phone, 'No active booking found.'); return }

  if (booking.confirmedAt) {
    await sendLockErrorWithCall(phone, `🔒 This appointment is already confirmed and can't be rescheduled online. To make changes, please call us.`)
    return
  }
  const minutesUntil = minutesUntilAppointment(booking.scheduledDate, booking.scheduledTime)
  if (minutesUntil <= RESCHEDULE_LOCK_MINUTES) {
    await sendLockErrorWithCall(phone, `⚠️ Too close to your appointment (within ${RESCHEDULE_LOCK_MINUTES} min). Please call us to reschedule.`)
    return
  }

  await openReschedulePicker(phone, booking._id, booking.bookingId)
}

async function openReschedulePicker(phone: string, bookingDocId: string, bookingId: string) {
  const days = await getAvailableDays(7)
  if (days.length === 0) {
    await sendText(phone, `😔 No slots available in the coming days. Please call us to reschedule.`)
    return
  }
  await updateSession(phone, {
    state: 'AWAITING_RESCHEDULE_DATE',
    activeBookingDocId: bookingDocId,
    activeBookingId: bookingId,
  })

  const rows = days.slice(0, 10).map((d) => ({
    id: `reschedule_day_${d.date}`,
    title: d.dayLabel.length > 24 ? d.dayLabel.slice(0, 24) : d.dayLabel,
    description: `${d.slots.length} slot${d.slots.length !== 1 ? 's' : ''} available`,
  }))

  await sendList(phone, 'Pick a new date for your appointment:', 'New Date', [
    { title: 'Available Days', rows },
  ])
}

// Dispatched from the conversation handler when the user taps a
// "reschedule_day_YYYY-MM-DD" row. Mirrors bookingFlow.handleDaySelection
// but uses the reschedule flow's session state.
export async function handleRescheduleDaySelection(phone: string, dateStr: string) {
  const session = await getSession(phone)
  if (session.state !== 'AWAITING_RESCHEDULE_DATE' || !session.activeBookingDocId) {
    await sendText(phone, `Reschedule session expired. Reply *reschedule* to start again.`)
    await resetSession(phone)
    return
  }
  const days = await getAvailableDays(7)
  const day = days.find((d) => d.date === dateStr)
  if (!day || day.slots.length === 0) {
    await sendText(phone, `No slots available for that day. Please choose another.`)
    await openReschedulePicker(phone, session.activeBookingDocId, session.activeBookingId!)
    return
  }

  await updateSession(phone, { state: 'AWAITING_RESCHEDULE_TIME', selectedDate: dateStr })

  const rows = day.slots.slice(0, 10).map((s) => ({
    id: `reschedule_slot_${dateStr}_${s.time}_${s.slotId}`,
    title: s.display,
    description: `${s.spotsLeft} spot${s.spotsLeft !== 1 ? 's' : ''} left`,
  }))

  await sendList(phone, `*${day.dayLabel}*\n\nChoose a new time:`, 'New Time', [
    { title: day.dayLabel.length > 24 ? day.dayLabel.slice(0, 24) : day.dayLabel, rows },
  ])
}

// Dispatched when the user taps a "reschedule_slot_…" row. Performs the
// slot swap and confirms. Re-checks the 30-min lock at the moment of commit
// to close the race where a user sits in the picker for >30 min.
export async function handleRescheduleSlotSelection(phone: string, slotPayload: string) {
  const session = await getSession(phone)
  if (session.state !== 'AWAITING_RESCHEDULE_TIME' || !session.activeBookingDocId) {
    await sendText(phone, `Reschedule session expired. Reply *reschedule* to start again.`)
    await resetSession(phone)
    return
  }

  // Parse the slot payload — same shape as bookingFlow.handleSlotSelection
  const withoutPrefix = slotPayload.replace('reschedule_slot_', '')
  const date = withoutPrefix.slice(0, 10)
  const rest = withoutPrefix.slice(11)
  const colonIdx = rest.indexOf(':')
  const time = rest.slice(0, colonIdx + 3)
  const newSlotId = rest.slice(colonIdx + 4)

  // Re-fetch the booking to check the lock at commit time
  const customer = await getCustomerByPhone(phone)
  if (!customer) { await sendText(phone, 'Customer record not found.'); return }
  const booking = await getLatestActiveBooking(customer._id)
  if (!booking || booking._id !== session.activeBookingDocId) {
    await sendText(phone, 'Booking not found. Reply *status* to see your active bookings.')
    await resetSession(phone)
    return
  }
  if (booking.confirmedAt) {
    await sendLockErrorWithCall(phone, `🔒 This appointment is already confirmed and can't be rescheduled online. To make changes, please call us.`)
    await resetSession(phone)
    return
  }
  const minutesUntil = minutesUntilAppointment(booking.scheduledDate, booking.scheduledTime)
  if (minutesUntil <= RESCHEDULE_LOCK_MINUTES) {
    await sendLockErrorWithCall(phone, `⚠️ Too close to your appointment (within ${RESCHEDULE_LOCK_MINUTES} min). Please call us to reschedule.`)
    await resetSession(phone)
    return
  }

  // Resolve old slot for the release-half of the swap
  const oldSlot = await getSlot(booking.scheduledDate, booking.scheduledTime)
  if (!oldSlot) {
    await sendText(phone, `Could not locate your current slot. Please call us to reschedule.`)
    await resetSession(phone)
    return
  }

  await rescheduleBooking(booking._id, date, time, oldSlot._id, newSlotId)

  const timeFormatted = format(new Date(`2000-01-01T${time}`), 'h:mm a')
  const dateFormatted = format(new Date(`${date}T12:00:00+05:30`), 'EEE, d MMM yyyy')
  await sendText(
    phone,
    `✅ *Rescheduled!*\n\n🎫 Booking: *${booking.bookingId}*\n📅 New date: ${dateFormatted}\n⏰ New time: ${timeFormatted}\n\nWe'll send a fresh reminder before your appointment.`
  )
  await resetSession(phone)
}

// Used by the 30m reminder's button handler. Resolves the booking and
// runs the same logic as startReschedule, but ignores the trailing
// bookingId arg (template buttons are static — we always look up the
// customer's most recent active booking).
export async function handleRemindReschedule(phone: string) {
  await startReschedule(phone)
}

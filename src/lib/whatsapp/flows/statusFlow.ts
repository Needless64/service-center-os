import { sendText, sendButtons, sendList } from '../client'
import { getCustomerByPhone, getActiveBookingForCustomer, getAllActiveBookingsForCustomer } from '../../sanity/queries'
import { cancelBooking } from '../../sanity/mutations'
import { STATUS_EMOJI, STATUS_LABELS, formatServiceType } from '../intentParser'
import { getSession, updateSession, resetSession } from '../sessionManager'
import { format, differenceInMinutes } from 'date-fns'

const RESCHEDULE_LOCK_MINUTES = 30

function minutesUntilAppointment(scheduledDate: string, scheduledTime: string): number {
  const appointmentDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`)
  return differenceInMinutes(appointmentDateTime, new Date())
}

// ─── Status check ─────────────────────────────────────────────────────────────

export async function handleStatusCheck(phone: string) {
  const customer = await getCustomerByPhone(phone)

  if (!customer) {
    await sendText(phone, `No booking found for this number.\n\nTo book a service, reply *book* or *service*.`)
    return
  }

  const bookings = await getAllActiveBookingsForCustomer(customer._id)

  if (bookings.length === 0) {
    await sendText(phone, `No active booking found, ${customer.name}.\n\nTo book a new service, reply *book*.`)
    return
  }

  // Single booking → show directly
  if (bookings.length === 1) {
    await showBookingStatus(phone, bookings[0])
    return
  }

  // Multiple bookings → show picker
  const rows = bookings.map((b) => ({
    id: `status_booking_${b._id}`,
    title: `${format(new Date(b.scheduledDate + 'T00:00:00'), 'd MMM')} ${format(new Date(`2000-01-01T${b.scheduledTime}`), 'h:mm a')}`,
    description: `${b.vehicleNumber} · ${formatServiceType(b.serviceType)}`,
  }))

  await sendList(
    phone,
    `You have *${bookings.length} active bookings*. Which one to check?`,
    'Select',
    [{ title: 'Your Bookings', rows }]
  )
}

// ─── Show status for a specific booking ──────────────────────────────────────

export async function showBookingStatus(phone: string, booking: SanityBookingLike) {
  const emoji = STATUS_EMOJI[booking.status] ?? '📋'
  const label = STATUS_LABELS[booking.status] ?? booking.status
  const dateFormatted = format(new Date(booking.scheduledDate + 'T00:00:00'), 'EEE, d MMM yyyy')
  const timeFormatted = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')

  let message = `${emoji} *Service Status*\n\n`
  message += `🎫 Booking: *${booking.bookingId}*\n`
  message += `🚗 Vehicle: ${booking.vehicleNumber} (${booking.vehicleModel ?? ''})\n`
  message += `📅 Appointment: ${dateFormatted} @ ${timeFormatted}\n`
  message += `🔧 Service: ${formatServiceType(booking.serviceType)}\n`
  message += `\n🔄 Status: *${label}*`

  if (booking.status === 'booked') {
    const minsLeft = minutesUntilAppointment(booking.scheduledDate, booking.scheduledTime)
    const canCancel = minsLeft > RESCHEDULE_LOCK_MINUTES

    message += `\n\n_Reminders will be sent before your appointment._`
    await updateSession(phone, { state: 'IDLE', activeBookingDocId: booking._id, activeBookingId: booking.bookingId })
    await sendText(phone, message)

    if (canCancel) {
      await sendButtons(phone, 'Would you like to cancel this booking?', [
        { id: 'action_cancel', title: '❌ Cancel Booking' },
      ])
    } else {
      await sendText(phone, `⚠️ Cancellations are locked within ${RESCHEDULE_LOCK_MINUTES} minutes of your appointment.`)
    }
    return
  }

  await sendText(phone, message)
}

// ─── Handle booking selection from picker ───────────────────────────────────

export async function handleBookingSelection(phone: string, bookingDocId: string) {
  const customer = await getCustomerByPhone(phone)
  if (!customer) return

  const bookings = await getAllActiveBookingsForCustomer(customer._id)
  const booking = bookings.find((b) => b._id === bookingDocId)
  if (!booking) {
    await sendText(phone, `Booking not found. Reply *status* to check again.`)
    return
  }

  await showBookingStatus(phone, booking)
}

// ─── Cancel request ───────────────────────────────────────────────────────────

export async function handleCancelRequest(phone: string) {
  const customer = await getCustomerByPhone(phone)
  if (!customer) {
    await sendText(phone, `No booking found. Reply *book* to schedule a service.`)
    return
  }

  const bookings = await getAllActiveBookingsForCustomer(customer._id)
  const cancellable = bookings.filter((b) => b.status === 'booked')

  if (cancellable.length === 0) {
    await sendText(phone, `No cancellable booking found. Only *Booked* appointments can be cancelled.`)
    return
  }

  // Single cancellable booking
  if (cancellable.length === 1) {
    await promptCancel(phone, cancellable[0])
    return
  }

  // Multiple — show picker
  const rows = cancellable.map((b) => ({
    id: `cancel_booking_${b._id}`,
    title: `${format(new Date(b.scheduledDate + 'T00:00:00'), 'd MMM')} ${format(new Date(`2000-01-01T${b.scheduledTime}`), 'h:mm a')}`,
    description: `${b.vehicleNumber} · ${formatServiceType(b.serviceType)}`,
  }))

  await sendList(phone, `Which booking to cancel?`, 'Select', [
    { title: 'Select to Cancel', rows },
  ])
}

async function promptCancel(phone: string, booking: SanityBookingLike) {
  const minsLeft = minutesUntilAppointment(booking.scheduledDate, booking.scheduledTime)
  if (minsLeft <= RESCHEDULE_LOCK_MINUTES) {
    await sendText(phone, `⚠️ Cannot cancel — appointment is within ${RESCHEDULE_LOCK_MINUTES} minutes. Please call us.`)
    return
  }

  await updateSession(phone, { activeBookingDocId: booking._id, activeBookingId: booking.bookingId })
  await sendButtons(
    phone,
    `Cancel *${booking.bookingId}*?\n📅 ${format(new Date(booking.scheduledDate + 'T00:00:00'), 'EEE, d MMM')} @ ${format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')}`,
    [
      { id: 'confirm_cancel', title: '✅ Yes, Cancel' },
      { id: 'keep_booking', title: '↩️ Keep Booking' },
    ]
  )
}

// ─── Handle cancel booking selection from picker ─────────────────────────────

export async function handleCancelBookingSelection(phone: string, bookingDocId: string) {
  const customer = await getCustomerByPhone(phone)
  if (!customer) return

  const bookings = await getAllActiveBookingsForCustomer(customer._id)
  const booking = bookings.find((b) => b._id === bookingDocId)
  if (!booking) {
    await sendText(phone, `Booking not found.`)
    return
  }
  await promptCancel(phone, booking)
}

// ─── Confirm cancel ───────────────────────────────────────────────────────────

export async function handleConfirmCancel(phone: string) {
  const session = await getSession(phone)
  const { activeBookingDocId, activeBookingId } = session

  if (!activeBookingDocId) {
    await sendText(phone, `Could not find your booking. Please try again.`)
    await resetSession(phone)
    return
  }

  const customer = await getCustomerByPhone(phone)
  if (customer) {
    const bookings = await getAllActiveBookingsForCustomer(customer._id)
    const booking = bookings.find((b) => b._id === activeBookingDocId)
    if (booking && minutesUntilAppointment(booking.scheduledDate, booking.scheduledTime) <= RESCHEDULE_LOCK_MINUTES) {
      await sendText(phone, `⚠️ Cannot cancel — appointment is within ${RESCHEDULE_LOCK_MINUTES} minutes. Please call us.`)
      await resetSession(phone)
      return
    }
  }

  await cancelBooking(activeBookingDocId)
  await sendText(phone, `✅ Booking *${activeBookingId}* cancelled.\n\nTo book again, reply *book*. 🙏`)
  await resetSession(phone)
}

// ─── Local type helper ────────────────────────────────────────────────────────

type SanityBookingLike = {
  _id: string
  bookingId: string
  vehicleNumber: string
  vehicleModel?: string
  serviceType: string
  scheduledDate: string
  scheduledTime: string
  status: string
}

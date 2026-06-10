import { sendText, sendButtons, sendList } from '../client'
import { getCustomerByPhone, getActiveBookingForCustomer, getAllActiveBookingsForCustomer, getSlot } from '../../sanity/queries'
import { cancelBooking, releaseSlot } from '../../sanity/mutations'
import { STATUS_EMOJI, STATUS_LABELS, formatServiceType } from '../intentParser'
import { getSession, updateSession, resetSession } from '../sessionManager'
import { t } from '../messages'
import { format, differenceInMinutes } from 'date-fns'
import { RESCHEDULE_LOCK_MINUTES } from '../locks'
import { getAgencyPhone } from '../env'

function minutesUntilAppointment(scheduledDate: string, scheduledTime: string): number {
  const appointmentDateTime = new Date(`${scheduledDate}T${scheduledTime}:00+05:30`)
  return differenceInMinutes(appointmentDateTime, new Date())
}

// Send a "you can't do this online, please call us" reply. Includes the
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

// ─── Status check ─────────────────────────────────────────────────────────────

export async function handleStatusCheck(phone: string) {
  const lang = (await getSession(phone)).language || 'en'
  const customer = await getCustomerByPhone(phone)

  if (!customer) {
    await sendText(phone, t(lang, 'status.no_booking'))
    return
  }

  const bookings = await getAllActiveBookingsForCustomer(customer._id)

  if (bookings.length === 0) {
    await sendText(phone, t(lang, 'status.no_active', customer.name))
    return
  }

  // Single booking → show directly
  if (bookings.length === 1) {
    await showBookingStatus(phone, bookings[0])
    return
  }

  // Multiple bookings → show picker. WhatsApp list messages cap at 10
  // rows; slice the most recent and hint about the rest.
  const recent = bookings.slice(0, 10)
  const rows = recent.map((b) => ({
    id: `status_booking_${b._id}`,
    title: `${format(new Date(b.scheduledDate + 'T00:00:00'), 'd MMM')} ${format(new Date(`2000-01-01T${b.scheduledTime}`), 'h:mm a')}`,
    description: `${b.vehicleNumber} · ${formatServiceType(b.serviceType)}`,
  }))

  const more = bookings.length - recent.length
  const moreHint = more > 0 ? `\n_Plus ${more} more — see them on our website._` : ''

  await sendList(
    phone,
    `You have *${bookings.length} active bookings*. Which one to check?${moreHint}`,
    'Select',
    [{ title: 'Your Bookings', rows }]
  )
}

// ─── Show status for a specific booking ──────────────────────────────────────

export async function showBookingStatus(phone: string, booking: SanityBookingLike) {
  const lang = (await getSession(phone)).language || 'en'
  const emoji = STATUS_EMOJI[booking.status] ?? '📋'
  const label = STATUS_LABELS[booking.status] ?? booking.status
  const dateFormatted = format(new Date(booking.scheduledDate + 'T00:00:00'), 'EEE, d MMM yyyy')
  const timeFormatted = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')

  let message = t(lang, 'status.body.full',
    emoji,
    booking.bookingId,
    booking.vehicleNumber,
    booking.vehicleModel ?? '',
    dateFormatted,
    timeFormatted,
    formatServiceType(booking.serviceType),
    label
  )

  if (booking.status === 'booked') {
    const minsLeft = minutesUntilAppointment(booking.scheduledDate, booking.scheduledTime)
    const canCancel = minsLeft > RESCHEDULE_LOCK_MINUTES

    message += `\n\n${t(lang, 'status.body.reminders_hint')}`
    await updateSession(phone, { state: 'IDLE', activeBookingDocId: booking._id, activeBookingId: booking.bookingId })
    await sendText(phone, message)

    if (canCancel) {
      await sendButtons(phone, 'Would you like to cancel this booking?', [
        { id: 'action_cancel', title: '❌ Cancel Booking' },
      ])
    } else {
      await sendLockErrorWithCall(phone, `⚠️ Cancellations are locked within ${RESCHEDULE_LOCK_MINUTES} minutes of your appointment. Please call us to make changes.`)
    }
    return
  }

  await sendText(phone, message)
}

// ─── Handle booking selection from picker ───────────────────────────────────

export async function handleBookingSelection(phone: string, bookingDocId: string) {
  const lang = (await getSession(phone)).language || 'en'
  const customer = await getCustomerByPhone(phone)
  if (!customer) return

  const bookings = await getAllActiveBookingsForCustomer(customer._id)
  const booking = bookings.find((b) => b._id === bookingDocId)
  if (!booking) {
    await sendText(phone, t(lang, 'status.picker_help'))
    return
  }

  await showBookingStatus(phone, booking)
}

// ─── Cancel request ───────────────────────────────────────────────────────────

export async function handleCancelRequest(phone: string) {
  const lang = (await getSession(phone)).language || 'en'
  const customer = await getCustomerByPhone(phone)
  if (!customer) {
    await sendText(phone, t(lang, 'status.no_booking_cta'))
    return
  }

  const bookings = await getAllActiveBookingsForCustomer(customer._id)
  const cancellable = bookings.filter((b) => b.status === 'booked')

  if (cancellable.length === 0) {
    await sendText(phone, t(lang, 'status.cancel_bookings_empty'))
    return
  }

  // Single cancellable booking
  if (cancellable.length === 1) {
    await promptCancel(phone, cancellable[0])
    return
  }

  // Multiple — show picker. WhatsApp list messages cap at 10 rows; slice.
  const recent = cancellable.slice(0, 10)
  const rows = recent.map((b) => ({
    id: `cancel_booking_${b._id}`,
    title: `${format(new Date(b.scheduledDate + 'T00:00:00'), 'd MMM')} ${format(new Date(`2000-01-01T${b.scheduledTime}`), 'h:mm a')}`,
    description: `${b.vehicleNumber} · ${formatServiceType(b.serviceType)}`,
  }))

  const more = cancellable.length - recent.length
  const moreHint = more > 0 ? `\n_Plus ${more} more — please call us for those._` : ''

  await sendList(phone, t(lang, 'status.cancel_picker', moreHint ?? ''), 'Select', [
    { title: 'Select to Cancel', rows },
  ])
}

async function promptCancel(phone: string, booking: SanityBookingLike) {
  const lang = (await getSession(phone)).language || 'en'
  const minsLeft = minutesUntilAppointment(booking.scheduledDate, booking.scheduledTime)
  if (minsLeft <= RESCHEDULE_LOCK_MINUTES) {
    await sendLockErrorWithCall(phone, t(lang, 'status.cancel_too_close', String(RESCHEDULE_LOCK_MINUTES)))
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
  const lang = (await getSession(phone)).language || 'en'
  const customer = await getCustomerByPhone(phone)
  if (!customer) return

  const bookings = await getAllActiveBookingsForCustomer(customer._id)
  const booking = bookings.find((b) => b._id === bookingDocId)
  if (!booking) {
    await sendText(phone, t(lang, 'status.booking_not_found'))
    return
  }
  await promptCancel(phone, booking)
}

// ─── Confirm cancel ───────────────────────────────────────────────────────────

export async function handleConfirmCancel(phone: string) {
  const session = await getSession(phone)
  const lang = session.language || 'en'
  const { activeBookingDocId, activeBookingId } = session

  if (!activeBookingDocId) {
    await sendText(phone, t(lang, 'status.cancel_failed_lookup'))
    await resetSession(phone)
    return
  }

  const customer = await getCustomerByPhone(phone)
  if (customer) {
    const bookings = await getAllActiveBookingsForCustomer(customer._id)
    const booking = bookings.find((b) => b._id === activeBookingDocId)
    if (booking && minutesUntilAppointment(booking.scheduledDate, booking.scheduledTime) <= RESCHEDULE_LOCK_MINUTES) {
      await sendLockErrorWithCall(phone, t(lang, 'status.cancel_too_close', String(RESCHEDULE_LOCK_MINUTES)))
      await resetSession(phone)
      return
    }
  }

  await cancelBooking(activeBookingDocId)
  // Best-effort slot release — the booking doesn't store slotId, so we
  // recover it by re-querying the customer's bookings and matching the
  // date+time against the slot document. Failures here must not block
  // the cancel response.
  try {
    const customer = await getCustomerByPhone(phone)
    if (customer) {
      const all = await getAllActiveBookingsForCustomer(customer._id)
      const target = all.find((b) => b._id === activeBookingDocId)
      if (target) {
        const slot = await getSlot(target.scheduledDate, target.scheduledTime)
        if (slot) await releaseSlot(slot._id)
      }
    }
  } catch (err) {
    console.error('[cancel] slot release failed:', err)
  }

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

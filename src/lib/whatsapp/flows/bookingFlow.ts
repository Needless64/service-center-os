import { sendText, sendList, sendButtons } from '../client'
import { getSession, updateSession, resetSession } from '../sessionManager'
import { formatServiceType } from '../intentParser'
import { getAvailableDays } from '../slotHelper'
import { getCustomerByPhone, getSlot, getDefaultBranch } from '../../sanity/queries'
import { createCustomer, createBooking, incrementSlot, addVehicleToCustomer, releaseSlot, updateBookingStatus } from '../../sanity/mutations'
import { t } from '../messages'
import { format } from 'date-fns'

const SERVICE_OPTIONS = [
  { id: 'free_service', title: 'Free Service' },
  { id: 'paid_service', title: 'General Paid Service' },
  { id: 'repair_diagnosis', title: 'Repair / Diagnosis' },
  { id: 'emergency', title: 'Emergency' },
  { id: 'other', title: 'Other' },
]

export async function startBooking(phone: string) {
  const customer = await getCustomerByPhone(phone)
  if (customer) {
    await updateSession(phone, { state: 'SELECTING_SERVICE_TYPE', existingCustomerId: customer._id, isReturningCustomer: true, customerName: customer.name })
  } else {
    await updateSession(phone, { state: 'SELECTING_SERVICE_TYPE', isReturningCustomer: false })
  }
  // No text greeting — drop straight to the service-type picker. The
  // first-time onboarding message in the welcome menu already
  // explains the workshop, so repeating it here is noise.

  await sendList(phone, 'Select the type of service you need:', 'Select Service', [
    { title: 'Service Types', rows: SERVICE_OPTIONS.map((s) => ({ id: `svc_${s.id}`, title: s.title })) },
  ])
}

export async function handleServiceTypeSelection(phone: string, serviceTypeId: string) {
  const serviceType = serviceTypeId.replace('svc_', '')
  const session = await getSession(phone)
  const lang = session.language || 'en'

  if (session.isReturningCustomer && session.existingCustomerId) {
    const customer = await getCustomerByPhone(phone)
    if (customer?.vehicles?.length) {
      await updateSession(phone, { serviceType, state: 'COLLECTING_VEHICLE_NUMBER' })
      await sendButtons(
        phone,
        `*${formatServiceType(serviceType)}* selected.\n\n${t(lang, 'booking.vehicle.which')}`,
        [
          { id: 'vehicles_menu', title: '🚗 Previous Vehicles' },
          { id: 'vehicle_new', title: '➕ New Vehicle' },
        ]
      )
      return
    }
  }

  await updateSession(phone, { serviceType, state: 'COLLECTING_VEHICLE_NUMBER' })
  await sendText(phone, `*${formatServiceType(serviceType)}* ${t(lang, 'booking.vehicle.selected', '')}\n${t(lang, 'booking.vehicle.number_prompt')}`)
}

export async function showPreviousVehiclesMenu(phone: string) {
  const lang = (await getSession(phone)).language || 'en'
  const customer = await getCustomerByPhone(phone)
  if (!customer?.vehicles?.length) {
    await updateSession(phone, { state: 'COLLECTING_VEHICLE_NUMBER' })
    await sendText(phone, t(lang, 'booking.vehicle.number_prompt'))
    return
  }
  const rows = customer.vehicles.map((v) => ({
    id: `vehicle_${v.vehicleNumber}`,
    title: v.vehicleNumber,
    description: v.vehicleModel || undefined,
  }))
  await sendList(phone, 'Select your vehicle:', 'Choose Vehicle', [
    { title: 'Your Vehicles', rows },
  ])
}

export async function handleVehicleSelection(phone: string, vehicleNumber: string) {
  const lang = (await getSession(phone)).language || 'en'
  if (vehicleNumber === 'new') {
    await updateSession(phone, { vehicleNumber: undefined, vehicleModel: undefined })
    await sendText(phone, t(lang, 'booking.vehicle.number_prompt'))
    return
  }
  const customer = await getCustomerByPhone(phone)
  const vehicle = customer?.vehicles?.find((v) => v.vehicleNumber === vehicleNumber)
  await updateSession(phone, { vehicleNumber, vehicleModel: vehicle?.vehicleModel ?? '', state: 'SELECTING_SLOT_DATE' })
  await sendText(phone, t(lang, 'booking.vehicle.selected', vehicleNumber))
  await showSlotSelection(phone)
}

export async function handleBookingTextInput(phone: string, text: string) {
  const session = await getSession(phone)
  const lang = session.language || 'en'

  switch (session.state) {
    case 'COLLECTING_VEHICLE_NUMBER': {
      // Vehicle model is no longer asked — skip straight to either
      // name collection (new customer) or slot selection (returning).
      await updateSession(phone, {
        vehicleNumber: text.toUpperCase(),
        vehicleModel: '',
        state: session.isReturningCustomer ? 'SELECTING_SLOT_DATE' : 'COLLECTING_CUSTOMER_NAME',
      })
      await sendText(phone, `Vehicle: *${text.toUpperCase()}* ✅`)
      if (session.isReturningCustomer) {
        await showSlotSelection(phone)
      } else {
        await sendText(phone, t(lang, 'booking.name.prompt'))
      }
      break
    }
    case 'COLLECTING_CUSTOMER_NAME': {
      await updateSession(phone, { customerName: text, state: 'SELECTING_SLOT_DATE' })
      await showSlotSelection(phone)
      break
    }
  }
}

async function showSlotSelection(phone: string) {
  const lang = (await getSession(phone)).language || 'en'
  const days = await getAvailableDays(7)
  if (days.length === 0) {
    await sendText(phone, `😔 No slots available in the coming days.\n\nPlease call us directly to book.`)
    await resetSession(phone)
    return
  }
  await updateSession(phone, { state: 'SELECTING_SLOT_DATE' })

  // Step 1: show available days (max 10 rows). Just the day label —
  // no slot count (the count was misleading when a day had 80 slots
  // but the customer was going to see a sparse time picker anyway).
  const rows = days.slice(0, 10).map((d) => ({
    id: `day_${d.date}`,
    title: d.dayLabel.length > 24 ? d.dayLabel.slice(0, 24) : d.dayLabel,
  }))

  await sendList(phone, 'Select a date for your appointment:', 'Choose Date', [
    { title: 'Available Days', rows },
  ])
}

export async function handleDaySelection(phone: string, dateStr: string) {
  const lang = (await getSession(phone)).language || 'en'
  const days = await getAvailableDays(7)
  const day = days.find((d) => d.date === dateStr)

  if (!day || day.slots.length === 0) {
    await sendText(phone, `No slots available for that day. Please choose another.`)
    await showSlotSelection(phone)
    return
  }

  // Group slots by hour (HH:00 → HH:59). One row per hour. The
  // hourly bucket row is only listed if the hour has at least one
  // bookable slot. The user picks an hour first, then a 6-min slot
  // within that hour — keeps the list under WhatsApp's 10-row cap.
  const byHour = new Map<string, { count: number; display: string }>()
  for (const s of day.slots) {
    const hour = s.time.slice(0, 2) // "09" from "09:00"
    const display = format(new Date(`2000-01-01T${hour}:00`), 'h a') // "9 AM"
    const existing = byHour.get(hour)
    if (existing) existing.count++
    else byHour.set(hour, { count: 1, display })
  }

  const hourRows = Array.from(byHour.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 10)
    .map(([hour, info]) => ({
      id: `hour_${dateStr}_${hour}`,
      title: info.display,
      description: `${info.count} slot${info.count !== 1 ? 's' : ''} available`,
    }))

  if (hourRows.length === 0) {
    await sendText(phone, `No slots available for that day. Please choose another.`)
    await showSlotSelection(phone)
    return
  }

  await updateSession(phone, { state: 'SELECTING_SLOT_HOUR' })
  await sendList(phone, `*${day.dayLabel}*\n\nPick an hour:`, 'Pick Hour', [
    { title: day.dayLabel.length > 24 ? day.dayLabel.slice(0, 24) : day.dayLabel, rows: hourRows },
  ])
}

// Dispatched when the user picks an hour bucket. Shows the 6-min
// slots for that hour.
export async function handleHourSelection(phone: string, hourPayload: string) {
  const lang = (await getSession(phone)).language || 'en'
  // hourPayload = "hour_2026-06-06_09"
  const m = hourPayload.match(/^hour_(\d{4}-\d{2}-\d{2})_(\d{2})$/)
  if (!m) {
    await sendText(phone, t(lang, 'booking.hour.invalid'))
    return
  }
  const [, dateStr, hour] = m

  const days = await getAvailableDays(7)
  const day = days.find((d) => d.date === dateStr)
  if (!day) {
    await sendText(phone, t(lang, 'booking.hour.day_missing'))
    await showSlotSelection(phone)
    return
  }

  const slotsInHour = day.slots
    .filter((s) => s.time.slice(0, 2) === hour)
    .slice(0, 10)

  if (slotsInHour.length === 0) {
    await sendText(phone, t(lang, 'booking.hour.full'))
    await handleDaySelection(phone, dateStr)
    return
  }

  const rows = slotsInHour.map((s) => ({
    id: `slot_${dateStr}_${s.time}_${s.slotId}`,
    title: s.display,
    description: `${s.spotsLeft} spot${s.spotsLeft !== 1 ? 's' : ''} left`,
  }))

  await updateSession(phone, { state: 'SELECTING_SLOT_TIME' })
  const hourLabel = format(new Date(`2000-01-01T${hour}:00`), 'h a')
  await sendList(phone, `*${day.dayLabel} · ${hourLabel}*\n\nChoose your time:`, 'Pick Time', [
    { title: day.dayLabel.length > 24 ? day.dayLabel.slice(0, 24) : day.dayLabel, rows },
  ])
}

export async function handleSlotSelection(phone: string, slotPayload: string) {
  const lang = (await getSession(phone)).language || 'en'
  const withoutPrefix = slotPayload.replace('slot_', '')
  const date = withoutPrefix.slice(0, 10)
  const rest = withoutPrefix.slice(11)
  const colonIdx = rest.indexOf(':')
  const time = rest.slice(0, colonIdx + 3)
  const slotId = rest.slice(colonIdx + 4)

  await updateSession(phone, { selectedDate: date, selectedTime: time, state: 'CONFIRMING_BOOKING' })
  const session = await getSession(phone)
  const timeFormatted = format(new Date(`2000-01-01T${time}`), 'h:mm a')
  const dateFormatted = format(new Date(date), 'EEE, d MMM yyyy')

  const summary = t(lang, 'booking.summary.full',
    formatServiceType(session.serviceType ?? ''),
    session.vehicleNumber ?? '',
    session.vehicleModel ?? '',
    dateFormatted,
    timeFormatted
  )

  await sendButtons(phone, summary, [
    { id: 'confirm_booking', title: '✅ Confirm' },
    { id: 'cancel_booking_flow', title: '❌ Cancel' },
  ])
}

export async function confirmBooking(phone: string) {
  const session = await getSession(phone)
  const lang = session.language || 'en'
  try {
    let customerId = session.existingCustomerId
    if (!customerId) {
      const customer = await createCustomer({ name: session.customerName || 'Customer', phoneNumber: phone, vehicleNumber: session.vehicleNumber!, vehicleModel: session.vehicleModel ?? '', manufacturer: '' })
      customerId = customer._id
    } else {
      const existing = await getCustomerByPhone(phone)
      const vehicleExists = existing?.vehicles?.some((v) => v.vehicleNumber === session.vehicleNumber)
      if (!vehicleExists) await addVehicleToCustomer(customerId, { vehicleNumber: session.vehicleNumber!, vehicleModel: session.vehicleModel ?? '', manufacturer: '' })
    }
    const booking = await createBooking({ customerId, vehicleNumber: session.vehicleNumber!, vehicleModel: session.vehicleModel ?? '', manufacturer: '', serviceType: session.serviceType!, scheduledDate: session.selectedDate!, scheduledTime: session.selectedTime!, notes: '' })
    const slotDoc = await getSlot(session.selectedDate!, session.selectedTime!)
    if (slotDoc) {
      const ok = await incrementSlot(slotDoc._id)
      if (ok) {
        // Post-increment capacity guard. If two confirms raced past capacity,
        // roll back this increment and the booking.
        const recheck = await getSlot(session.selectedDate!, session.selectedTime!)
        if (recheck && recheck.currentBookings > recheck.capacity) {
          await releaseSlot(slotDoc._id)
          await updateBookingStatus(booking._id, 'cancelled')
          throw new Error('Slot overbooked; rolled back.')
        }
      } else {
        // increment failed outright — refuse the booking
        await updateBookingStatus(booking._id, 'cancelled')
        throw new Error('Slot increment failed; refusing booking.')
      }
    }
    const timeFormatted = format(new Date(`2000-01-01T${session.selectedTime}`), 'h:mm a')
    const dateFormatted = format(new Date(session.selectedDate!), 'EEE, d MMM yyyy')
    await sendText(phone, t(lang, 'booking.confirmed.full',
      booking.bookingId,
      dateFormatted,
      timeFormatted,
      session.vehicleNumber ?? '',
      formatServiceType(session.serviceType ?? ''),
      dateFormatted
    ))
    await updateSession(phone, { state: 'BOOKING_CONFIRMED' })
    await resetSession(phone)
  } catch (err) {
    console.error('[bookingFlow] confirm error:', err)
    await sendText(phone, t(lang, 'booking.error'))
    await resetSession(phone)
  }
}

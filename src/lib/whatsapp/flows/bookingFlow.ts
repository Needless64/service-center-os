import { sendText, sendList, sendButtons } from '../client'
import { getSession, updateSession, resetSession } from '../sessionManager'
import { formatServiceType } from '../intentParser'
import { getAvailableDays } from '../slotHelper'
import { getCustomerByPhone, getSlot, getDefaultBranch } from '../../sanity/queries'
import { createCustomer, createBooking, incrementSlot, addVehicleToCustomer, releaseSlot, updateBookingStatus } from '../../sanity/mutations'
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

  if (session.isReturningCustomer && session.existingCustomerId) {
    const customer = await getCustomerByPhone(phone)
    if (customer?.vehicles?.length) {
      await updateSession(phone, { serviceType, state: 'COLLECTING_VEHICLE_NUMBER' })
      await sendButtons(
        phone,
        `*${formatServiceType(serviceType)}* selected.\n\nWhich vehicle?`,
        [
          { id: 'vehicles_menu', title: '🚗 Previous Vehicles' },
          { id: 'vehicle_new', title: '➕ New Vehicle' },
        ]
      )
      return
    }
  }

  await updateSession(phone, { serviceType, state: 'COLLECTING_VEHICLE_NUMBER' })
  await sendText(phone, `*${formatServiceType(serviceType)}* selected.\n\nEnter your *vehicle registration number*:\n_(Example: TS09AB1234)_`)
}

export async function showPreviousVehiclesMenu(phone: string) {
  const customer = await getCustomerByPhone(phone)
  if (!customer?.vehicles?.length) {
    await updateSession(phone, { state: 'COLLECTING_VEHICLE_NUMBER' })
    await sendText(phone, `Enter your *vehicle registration number*:\n_(Example: TS09AB1234)_`)
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
  if (vehicleNumber === 'new') {
    await updateSession(phone, { vehicleNumber: undefined, vehicleModel: undefined })
    await sendText(phone, `Enter the *vehicle registration number*:\n_(Example: TS09AB1234)_`)
    return
  }
  const customer = await getCustomerByPhone(phone)
  const vehicle = customer?.vehicles?.find((v) => v.vehicleNumber === vehicleNumber)
  await updateSession(phone, { vehicleNumber, vehicleModel: vehicle?.vehicleModel ?? '', state: 'SELECTING_SLOT_DATE' })
  await sendText(phone, `*${vehicleNumber}* selected.`)
  await showSlotSelection(phone)
}

export async function handleBookingTextInput(phone: string, text: string) {
  const session = await getSession(phone)

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
        await sendText(phone, `Now, what is your *full name*?`)
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
  const days = await getAvailableDays(7)
  const day = days.find((d) => d.date === dateStr)

  if (!day || day.slots.length === 0) {
    await sendText(phone, `No slots available for that day. Please choose another.`)
    await showSlotSelection(phone)
    return
  }

  // Step 2: show time slots for selected day (max 10)
  const rows = day.slots.slice(0, 10).map((s) => ({
    id: `slot_${dateStr}_${s.time}_${s.slotId}`,
    title: s.display,
    description: `${s.spotsLeft} spot${s.spotsLeft !== 1 ? 's' : ''} left`,
  }))

  await sendList(phone, `*${day.dayLabel}*\n\nChoose your time slot:`, 'Pick Time', [
    { title: day.dayLabel.length > 24 ? day.dayLabel.slice(0, 24) : day.dayLabel, rows },
  ])
}

export async function handleSlotSelection(phone: string, slotPayload: string) {
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

  const summary = [
    `📋 *Booking Summary*`, ``,
    `🔧 Service: ${formatServiceType(session.serviceType ?? '')}`,
    `🚗 Vehicle: ${session.vehicleNumber} (${session.vehicleModel ?? ''})`,
    `📅 Date: ${dateFormatted}`, `⏰ Time: ${timeFormatted}`, ``,
    `Confirm this booking?`,
  ].join('\n')

  await sendButtons(phone, summary, [
    { id: 'confirm_booking', title: '✅ Confirm' },
    { id: 'cancel_booking_flow', title: '❌ Cancel' },
  ])
}

export async function confirmBooking(phone: string) {
  const session = await getSession(phone)
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
    await sendText(phone, `✅ *Booking Confirmed!*\n\n🎫 Booking ID: *${booking.bookingId}*\n📅 Date: ${dateFormatted}\n⏰ Time: ${timeFormatted}\n🚗 Vehicle: ${session.vehicleNumber}\n🔧 Service: ${formatServiceType(session.serviceType ?? '')}\n\nWe'll send you reminders before your appointment.\n\nTo check status, reply: *status*\nTo cancel, reply: *cancel*\n\nSee you on ${dateFormatted}! 🙏`)
    await updateSession(phone, { state: 'BOOKING_CONFIRMED' })
    await resetSession(phone)
  } catch (err) {
    console.error('[bookingFlow] confirm error:', err)
    await sendText(phone, `Sorry, something went wrong. Please try again or call us directly.`)
    await resetSession(phone)
  }
}

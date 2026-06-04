import { sendText, sendList, sendButtons } from '../client'
import { getSession, updateSession, resetSession } from '../sessionManager'
import { formatServiceType } from '../intentParser'
import { getAvailableDays } from '../slotHelper'
import { getCustomerByPhone, getSlot, getDefaultBranch } from '../../sanity/queries'
import { createCustomer, createBooking, incrementSlot, addVehicleToCustomer } from '../../sanity/mutations'
import { format } from 'date-fns'

const SERVICE_OPTIONS = [
  { id: 'free_service', title: 'Free Service' },
  { id: 'paid_service', title: 'General Paid Service' },
  { id: 'repair_diagnosis', title: 'Repair / Diagnosis' },
  { id: 'emergency', title: 'Emergency' },
  { id: 'other', title: 'Other' },
]

export async function startBooking(phone: string) {
  const [customer, branch] = await Promise.all([getCustomerByPhone(phone), getDefaultBranch()])
  const baseGreeting = branch?.whatsappGreeting ?? 'Welcome to our Service Center!'

  if (customer) {
    await updateSession(phone, { state: 'SELECTING_SERVICE_TYPE', existingCustomerId: customer._id, isReturningCustomer: true, customerName: customer.name })
    const vehicleCount = customer.vehicles?.length ?? 0
    const greeting = vehicleCount > 0
      ? `Welcome back, *${customer.name}*! 👋\n\nLast vehicle: *${customer.vehicles[0].vehicleNumber}* (${customer.vehicles[0].vehicleModel || ''})\n\nLet's get your vehicle booked.`
      : `Welcome back, *${customer.name}*! 👋\n\n${baseGreeting}`
    await sendText(phone, greeting)
  } else {
    await updateSession(phone, { state: 'SELECTING_SERVICE_TYPE', isReturningCustomer: false })
    await sendText(phone, `${baseGreeting} 🚗\n\nLet's get your vehicle booked in 2 minutes.`)
  }

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
        // Max 3 WhatsApp buttons: show up to 2 existing vehicles + always "+ New Vehicle"
      const vehicleButtons = [
        ...customer.vehicles.slice(0, 2).map((v) => ({ id: `vehicle_${v.vehicleNumber}`, title: v.vehicleNumber })),
        { id: 'vehicle_new', title: '+ New Vehicle' },
      ]
      await sendButtons(phone, `*${formatServiceType(serviceType)}* selected.\n\nWhich vehicle?`, vehicleButtons)
      return
    }
  }

  await updateSession(phone, { serviceType, state: 'COLLECTING_VEHICLE_NUMBER' })
  await sendText(phone, `*${formatServiceType(serviceType)}* selected.\n\nEnter your *vehicle registration number*:\n_(Example: TS09AB1234)_`)
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
      await updateSession(phone, { vehicleNumber: text.toUpperCase(), state: 'COLLECTING_VEHICLE_MODEL' })
      await sendText(phone, `Vehicle: *${text.toUpperCase()}* ✅\n\nWhat is the *vehicle model*?\n_(Example: Honda Activa 6G, Maruti Swift)_`)
      break
    }
    case 'COLLECTING_VEHICLE_MODEL': {
      await updateSession(phone, { vehicleModel: text })
      const updated = await getSession(phone)
      if (updated.isReturningCustomer) {
        await updateSession(phone, { state: 'SELECTING_SLOT_DATE' })
        await showSlotSelection(phone)
      } else {
        await updateSession(phone, { state: 'COLLECTING_CUSTOMER_NAME' })
        await sendText(phone, `Model: *${text}* ✅\n\nEnter your *full name*:`)
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

  // Step 1: show available days (max 10 rows)
  const rows = days.slice(0, 10).map((d) => ({
    id: `day_${d.date}`,
    title: d.dayLabel.length > 24 ? d.dayLabel.slice(0, 24) : d.dayLabel,
    description: `${d.slots.length} slot${d.slots.length !== 1 ? 's' : ''} available`,
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
      const customer = await createCustomer({ name: session.customerName!, phoneNumber: phone, vehicleNumber: session.vehicleNumber!, vehicleModel: session.vehicleModel ?? '', manufacturer: '' })
      customerId = customer._id
    } else {
      const existing = await getCustomerByPhone(phone)
      const vehicleExists = existing?.vehicles?.some((v) => v.vehicleNumber === session.vehicleNumber)
      if (!vehicleExists) await addVehicleToCustomer(customerId, { vehicleNumber: session.vehicleNumber!, vehicleModel: session.vehicleModel ?? '', manufacturer: '' })
    }
    const booking = await createBooking({ customerId, vehicleNumber: session.vehicleNumber!, vehicleModel: session.vehicleModel ?? '', manufacturer: '', serviceType: session.serviceType!, scheduledDate: session.selectedDate!, scheduledTime: session.selectedTime!, notes: '' })
    const slotDoc = await getSlot(session.selectedDate!, session.selectedTime!)
    if (slotDoc) await incrementSlot(slotDoc._id)
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

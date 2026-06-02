import { sendText, sendList, sendButtons } from '../client'
import { getSession, updateSession, resetSession } from '../sessionManager'
import { formatServiceType } from '../intentParser'
import { getNextAvailableSlots } from '../slotHelper'
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

// ─── Start booking flow ──────────────────────────────────────────────────────

export async function startBooking(phone: string) {
  const [customer, branch] = await Promise.all([
    getCustomerByPhone(phone),
    getDefaultBranch(),
  ])

  const baseGreeting = branch?.whatsappGreeting ?? 'Welcome to our Service Center!'

  if (customer) {
    updateSession(phone, {
      state: 'SELECTING_SERVICE_TYPE',
      existingCustomerId: customer._id,
      isReturningCustomer: true,
      customerName: customer.name,
    })

    const vehicleCount = customer.vehicles?.length ?? 0
    const greeting = vehicleCount > 0
      ? `Welcome back, *${customer.name}*! 👋\n\nLast vehicle: *${customer.vehicles[0].vehicleNumber}* (${customer.vehicles[0].vehicleModel || ''})\n\nLet's get your vehicle booked.`
      : `Welcome back, *${customer.name}*! 👋\n\n${baseGreeting}`

    await sendText(phone, greeting)
  } else {
    updateSession(phone, { state: 'SELECTING_SERVICE_TYPE', isReturningCustomer: false })
    await sendText(phone, `${baseGreeting} 🚗\n\nLet's get your vehicle booked in 2 minutes.`)
  }

  await sendList(phone, 'Select the type of service you need:', 'Select Service', [
    {
      title: 'Service Types',
      rows: SERVICE_OPTIONS.map((s) => ({ id: `svc_${s.id}`, title: s.title })),
    },
  ])
}

// ─── Handle service type selection ──────────────────────────────────────────

export async function handleServiceTypeSelection(phone: string, serviceTypeId: string) {
  const serviceType = serviceTypeId.replace('svc_', '')
  const session = getSession(phone)

  // Returning customer with known vehicles — offer to reuse
  if (session.isReturningCustomer && session.existingCustomerId) {
    const customer = await getCustomerByPhone(phone)
    if (customer?.vehicles?.length) {
      updateSession(phone, { serviceType, state: 'COLLECTING_VEHICLE_NUMBER' })

      const vehicleButtons = customer.vehicles.slice(0, 3).map((v) => ({
        id: `vehicle_${v.vehicleNumber}`,
        title: v.vehicleNumber,
      }))
      vehicleButtons.push({ id: 'vehicle_new', title: '+ New Vehicle' })

      await sendButtons(
        phone,
        `*${formatServiceType(serviceType)}* selected.\n\nWhich vehicle?`,
        vehicleButtons.slice(0, 3)
      )
      return
    }
  }

  updateSession(phone, { serviceType, state: 'COLLECTING_VEHICLE_NUMBER' })
  await sendText(
    phone,
    `*${formatServiceType(serviceType)}* selected.\n\nEnter your *vehicle registration number*:\n_(Example: TS09AB1234)_`
  )
}

// ─── Handle vehicle button selection ─────────────────────────────────────────

export async function handleVehicleSelection(phone: string, vehicleNumber: string) {
  if (vehicleNumber === 'new') {
    updateSession(phone, { vehicleNumber: undefined, vehicleModel: undefined })
    await sendText(phone, `Enter the *vehicle registration number*:\n_(Example: TS09AB1234)_`)
    return
  }

  const customer = await getCustomerByPhone(phone)
  const vehicle = customer?.vehicles?.find((v) => v.vehicleNumber === vehicleNumber)

  updateSession(phone, {
    vehicleNumber,
    vehicleModel: vehicle?.vehicleModel ?? '',
    state: 'SELECTING_SLOT_DATE',
  })

  await sendText(phone, `*${vehicleNumber}* selected.`)
  await showSlotSelection(phone)
}

// ─── Handle text input based on state ───────────────────────────────────────

export async function handleBookingTextInput(phone: string, text: string) {
  const session = getSession(phone)

  switch (session.state) {
    case 'COLLECTING_VEHICLE_NUMBER': {
      updateSession(phone, { vehicleNumber: text.toUpperCase(), state: 'COLLECTING_VEHICLE_MODEL' })
      await sendText(phone, `Vehicle: *${text.toUpperCase()}* ✅\n\nWhat is the *vehicle model*?\n_(Example: Honda Activa 6G, Maruti Swift)_`)
      break
    }

    case 'COLLECTING_VEHICLE_MODEL': {
      updateSession(phone, { vehicleModel: text })

      if (getSession(phone).isReturningCustomer) {
        updateSession(phone, { state: 'SELECTING_SLOT_DATE' })
        await showSlotSelection(phone)
      } else {
        updateSession(phone, { state: 'COLLECTING_CUSTOMER_NAME' })
        await sendText(phone, `Model: *${text}* ✅\n\nEnter your *full name*:`)
      }
      break
    }

    case 'COLLECTING_CUSTOMER_NAME': {
      updateSession(phone, { customerName: text, state: 'SELECTING_SLOT_DATE' })
      await showSlotSelection(phone)
      break
    }
  }
}

// ─── Slot selection ──────────────────────────────────────────────────────────

async function showSlotSelection(phone: string) {
  // Flat list: up to 10 slots across next 7 working days (single step date+time)
  const slots = await getNextAvailableSlots(10, 7)

  if (slots.length === 0) {
    await sendText(phone, `😔 No slots available in the coming days.\n\nPlease call us directly to book.`)
    resetSession(phone)
    return
  }

  updateSession(phone, { state: 'SELECTING_SLOT_DATE' })

  const rows = slots.map((s) => ({
    id: `slot_${s.date}_${s.time}_${s.slotId}`,
    title: s.display,                                              // "Tmr · 9:00 AM" or "Wed 4 Jun · 9:00 AM"
    description: `${s.spotsLeft} spot${s.spotsLeft !== 1 ? 's' : ''} left`,
  }))

  await sendList(phone, 'Pick your appointment slot:', 'View Slots', [
    { title: 'Available Slots', rows },
  ])
}

// ─── Handle slot selection ───────────────────────────────────────────────────

export async function handleSlotSelection(phone: string, slotPayload: string) {
  // Format: slot_{yyyy-MM-dd}_{HH:MM}_{sanityId}
  const withoutPrefix = slotPayload.replace('slot_', '')
  const date = withoutPrefix.slice(0, 10)               // yyyy-MM-dd
  const rest = withoutPrefix.slice(11)                   // HH:MM_{sanityId}
  const colonIdx = rest.indexOf(':')
  const time = rest.slice(0, colonIdx + 3)               // HH:MM
  const slotId = rest.slice(colonIdx + 4)                // sanityId after HH:MM_

  updateSession(phone, { selectedDate: date, selectedTime: time, state: 'CONFIRMING_BOOKING' })

  const session = getSession(phone)
  const timeFormatted = format(new Date(`2000-01-01T${time}`), 'h:mm a')
  const dateFormatted = format(new Date(date), 'EEE, d MMM yyyy')

  const summary = [
    `📋 *Booking Summary*`,
    ``,
    `🔧 Service: ${formatServiceType(session.serviceType ?? '')}`,
    `🚗 Vehicle: ${session.vehicleNumber} (${session.vehicleModel ?? ''})`,
    `📅 Date: ${dateFormatted}`,
    `⏰ Time: ${timeFormatted}`,
    ``,
    `Confirm this booking?`,
  ].join('\n')

  await sendButtons(phone, summary, [
    { id: 'confirm_booking', title: '✅ Confirm' },
    { id: 'cancel_booking_flow', title: '❌ Cancel' },
  ])
}

// ─── Confirm & create booking ────────────────────────────────────────────────

export async function confirmBooking(phone: string) {
  const session = getSession(phone)

  try {
    let customerId = session.existingCustomerId

    if (!customerId) {
      const customer = await createCustomer({
        name: session.customerName!,
        phoneNumber: phone,
        vehicleNumber: session.vehicleNumber!,
        vehicleModel: session.vehicleModel ?? '',
        manufacturer: '',
      })
      customerId = customer._id
    } else {
      const existing = await getCustomerByPhone(phone)
      const vehicleExists = existing?.vehicles?.some((v) => v.vehicleNumber === session.vehicleNumber)
      if (!vehicleExists) {
        await addVehicleToCustomer(customerId, {
          vehicleNumber: session.vehicleNumber!,
          vehicleModel: session.vehicleModel ?? '',
          manufacturer: '',
        })
      }
    }

    const booking = await createBooking({
      customerId,
      vehicleNumber: session.vehicleNumber!,
      vehicleModel: session.vehicleModel ?? '',
      manufacturer: '',
      serviceType: session.serviceType!,
      scheduledDate: session.selectedDate!,
      scheduledTime: session.selectedTime!,
      notes: '',
    })

    const slotDoc = await getSlot(session.selectedDate!, session.selectedTime!)
    if (slotDoc) await incrementSlot(slotDoc._id)

    const timeFormatted = format(new Date(`2000-01-01T${session.selectedTime}`), 'h:mm a')
    const dateFormatted = format(new Date(session.selectedDate!), 'EEE, d MMM yyyy')

    await sendText(
      phone,
      `✅ *Booking Confirmed!*\n\n` +
        `🎫 Booking ID: *${booking.bookingId}*\n` +
        `📅 Date: ${dateFormatted}\n` +
        `⏰ Time: ${timeFormatted}\n` +
        `🚗 Vehicle: ${session.vehicleNumber}\n` +
        `🔧 Service: ${formatServiceType(session.serviceType ?? '')}\n\n` +
        `We'll send you reminders before your appointment.\n\n` +
        `To check status, reply: *status*\n` +
        `To cancel, reply: *cancel*\n\n` +
        `See you on ${dateFormatted}! 🙏`
    )

    updateSession(phone, { state: 'BOOKING_CONFIRMED' })
    setTimeout(() => resetSession(phone), 5000)
  } catch (err) {
    console.error('[bookingFlow] confirm error:', err)
    await sendText(phone, `Sorry, something went wrong. Please try again or call us directly.`)
    resetSession(phone)
  }
}

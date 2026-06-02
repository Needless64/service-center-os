import { sendText, sendButtons } from './client'
import { getSession, resetSession } from './sessionManager'
import { parseIntent } from './intentParser'
import { startBooking, handleServiceTypeSelection, handleVehicleSelection, handleBookingTextInput, handleSlotSelection, confirmBooking } from './flows/bookingFlow'
import { handleStatusCheck, handleCancelRequest, handleConfirmCancel, handleBookingSelection, handleCancelBookingSelection } from './flows/statusFlow'

export async function handleIncomingMessage(phone: string, text: string, interactiveId?: string) {
  const session = await getSession(phone)

  if (interactiveId) {
    await handleInteractiveReply(phone, interactiveId)
    return
  }

  const state = session.state
  if (state === 'COLLECTING_VEHICLE_NUMBER' || state === 'COLLECTING_VEHICLE_MODEL' || state === 'COLLECTING_CUSTOMER_NAME') {
    await handleBookingTextInput(phone, text)
    return
  }

  const intent = parseIntent(text)
  switch (intent) {
    case 'BOOK_SERVICE': await startBooking(phone); break
    case 'CHECK_STATUS': await handleStatusCheck(phone); break
    case 'CANCEL_BOOKING': await handleCancelRequest(phone); break
    case 'CONFIRM_YES':
      if (state === 'CONFIRMING_BOOKING') { await confirmBooking(phone) } else { await sendWelcome(phone) }
      break
    case 'CONFIRM_NO':
      await resetSession(phone)
      await sendText(phone, `No problem! Reply *book* when you're ready. 😊`)
      break
    case 'HELP':
    default:
      await sendWelcome(phone)
  }
}

async function handleInteractiveReply(phone: string, id: string) {
  if (id.startsWith('svc_')) { await handleServiceTypeSelection(phone, id); return }
  if (id.startsWith('slot_')) { await handleSlotSelection(phone, id); return }
  if (id.startsWith('vehicle_')) { await handleVehicleSelection(phone, id.replace('vehicle_', '')); return }
  if (id.startsWith('status_booking_')) { await handleBookingSelection(phone, id.replace('status_booking_', '')); return }
  if (id.startsWith('cancel_booking_')) { await handleCancelBookingSelection(phone, id.replace('cancel_booking_', '')); return }

  switch (id) {
    case 'action_book': await startBooking(phone); break
    case 'action_status': await handleStatusCheck(phone); break
    case 'action_cancel': await handleCancelRequest(phone); break
    case 'confirm_booking': await confirmBooking(phone); break
    case 'cancel_booking_flow':
      await resetSession(phone)
      await sendText(phone, `No problem. Reply *book* whenever you're ready. 👋`)
      break
    case 'confirm_cancel': await handleConfirmCancel(phone); break
    case 'keep_booking':
      await resetSession(phone)
      await sendText(phone, `Booking kept. See you at your appointment! 👍`)
      break
    default: await sendWelcome(phone)
  }
}

async function sendWelcome(phone: string) {
  await sendButtons(phone, `👋 Welcome! I'm your *Service Center assistant*.\n\nWhat would you like to do?`, [
    { id: 'action_book', title: '📅 Book Service' },
    { id: 'action_status', title: '📊 My Status' },
    { id: 'action_cancel', title: '❌ Cancel Booking' },
  ])
}

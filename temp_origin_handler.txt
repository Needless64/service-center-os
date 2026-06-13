import { sendText, sendButtons } from './client'
import { getSession, resetSession, wasOnboarded, updateSession } from './sessionManager'
import { parseIntent } from './intentParser'
import { startBooking, handleServiceTypeSelection, handleVehicleSelection, showPreviousVehiclesMenu, handleBookingTextInput, handleSlotSelection, handleDaySelection, handleHourSelection, confirmBooking } from './flows/bookingFlow'
import { handleStatusCheck, handleCancelRequest, handleConfirmCancel, handleBookingSelection, handleCancelBookingSelection } from './flows/statusFlow'
import { handleRemindConfirm, handleRemindReschedule, startReschedule, handleRescheduleDaySelection, handleRescheduleSlotSelection } from './flows/reminderActions'
import { t, BILINGUAL_GREETING } from './messages'
import type { Lang } from './messages'

export async function handleIncomingMessage(phone: string, text: string, interactiveId?: string) {
  let session
  try {
    session = await getSession(phone)
  } catch (err) {
    console.error('[handler] getSession failed:', err)
    session = null
  }

  try {
    if (interactiveId) {
      await handleInteractiveReply(phone, interactiveId)
      return
    }

    // If language not set yet, check for text-based language selection first
    if (session && !session.language) {
      const lower = text.trim().toLowerCase()
      if (lower === 'english' || lower === 'en') {
        await updateSession(phone, { language: 'en' })
        await sendWelcome(phone)
        return
      }
      if (lower === 'gujarati' || lower === 'gu' || lower === 'guj') {
        await updateSession(phone, { language: 'gu' })
        await sendWelcome(phone)
        return
      }
      // Language not set and not a selection text \u2014 show language picker
      await sendWelcome(phone)
      return
    }

    // Treat a missing session as a fresh user \u2014 no collecting state to escape.
    const state = session?.state
    if (state === 'COLLECTING_VEHICLE_NUMBER' || state === 'COLLECTING_CUSTOMER_NAME') {
      // Allow the user to escape the data-entry state with control keywords
      const lower = text.trim().toLowerCase()
      const escape =
        lower === 'cancel' || lower === 'stop' || lower === 'exit' ||
        lower === 'menu' || lower === 'help' || lower === 'hi' || lower === 'hello' ||
        lower === 'start' || lower === 'book' || lower === 'status'
      if (escape) {
        await resetSession(phone)
        const lang = session?.language || 'en'
        await sendText(phone, t(lang, 'handler.escape'))
        return
      }
      await handleBookingTextInput(phone, text)
      return
    }

    const lang = session?.language || 'en'
    const intent = parseIntent(text)
    switch (intent) {
      case 'BOOK_SERVICE': await startBooking(phone); break
      case 'CHECK_STATUS': await handleStatusCheck(phone); break
      case 'CANCEL_BOOKING': await handleCancelRequest(phone); break
      case 'RESCHEDULE_BOOKING': await startReschedule(phone); break
      case 'CONFIRM_YES':
        if (state === 'CONFIRMING_BOOKING') { await confirmBooking(phone) } else { await sendWelcome(phone) }
        break
      case 'CONFIRM_NO':
        await resetSession(phone)
        await sendText(phone, t(lang, 'handler.confirm_no'))
        break
      case 'HELP':
      default:
        await sendWelcome(phone)
    }
  } catch (err) {
    console.error('[handler] message processing failed:', err)
    try {
      const lang = session?.language || 'en'
      await sendText(phone, t(lang, 'handler.error.generic'))
    } catch {
      // best-effort only
    }
  }
}

async function handleInteractiveReply(phone: string, id: string) {
  try {
    // Language selection
    if (id === 'lang_en') { await handleLanguageSelection(phone, 'en'); return }
    if (id === 'lang_gu') { await handleLanguageSelection(phone, 'gu'); return }

    if (id.startsWith('svc_')) { await handleServiceTypeSelection(phone, id); return }
    if (id.startsWith('day_')) { await handleDaySelection(phone, id.replace('day_', '')); return }
    if (id.startsWith('hour_')) { await handleHourSelection(phone, id); return }
    if (id.startsWith('slot_')) { await handleSlotSelection(phone, id); return }
    if (id === 'vehicles_menu') { await showPreviousVehiclesMenu(phone); return }
    if (id.startsWith('vehicle_')) { await handleVehicleSelection(phone, id.replace('vehicle_', '')); return }
    if (id.startsWith('status_booking_')) { await handleBookingSelection(phone, id.replace('status_booking_', '')); return }
    if (id.startsWith('cancel_booking_')) { await handleCancelBookingSelection(phone, id.replace('cancel_booking_', '')); return }
    if (id.startsWith('remind_confirm')) { await handleRemindConfirm(phone); return }
    if (id.startsWith('remind_reschedule')) { await handleRemindReschedule(phone); return }
    if (id.startsWith('reschedule_day_')) { await handleRescheduleDaySelection(phone, id.replace('reschedule_day_', '')); return }
    if (id.startsWith('reschedule_slot_')) { await handleRescheduleSlotSelection(phone, id); return }

    const lang = (await getSession(phone)).language || 'en'

    switch (id) {
      case 'action_book': await startBooking(phone); break
      case 'action_status': await handleStatusCheck(phone); break
      case 'action_manage': await handleManageBookingEntry(phone); break
      case 'manage_cancel': await handleCancelRequest(phone); break
      case 'manage_reschedule': await startReschedule(phone); break
      case 'confirm_booking': await confirmBooking(phone); break
      case 'cancel_booking_flow':
        await resetSession(phone)
        await sendText(phone, t(lang, 'handler.cancel_flow'))
        break
      case 'confirm_cancel': await handleConfirmCancel(phone); break
      case 'keep_booking':
        await resetSession(phone)
        await sendText(phone, t(lang, 'handler.keep_booking'))
        break
      default: await sendWelcome(phone)
    }
  } catch (err) {
    console.error('[handler] interactive reply failed:', err)
    try {
      const lang = (await getSession(phone)).language || 'en'
      await resetSession(phone)
      await sendText(phone, t(lang, 'handler.error.interactive'))
    } catch {}
  }
}

async function handleLanguageSelection(phone: string, language: Lang) {
  await updateSession(phone, { language, state: 'IDLE' })
  await sendWelcome(phone)
}

async function sendWelcome(phone: string) {
  const session = await getSession(phone)
  const lang = session.language

  // If language not set yet \u2014 show bilingual greeting + language picker
  if (!lang) {
    const alreadyOnboarded = await wasOnboarded(phone)
    if (!alreadyOnboarded) {
      await sendText(phone, BILINGUAL_GREETING)
      await updateSession(phone, { onboardedAt: Date.now() })
    }
    await sendButtons(phone, '🌐 Choose your language / તમારી ભાષા પસંદ કરો:', [
      { id: 'lang_en', title: 'English' },
      { id: 'lang_gu', title: '\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0' },
    ])
    return
  }

  // Language is set \u2014 show welcome menu in chosen language
  await sendButtons(phone, t(lang, 'welcome.menu.body'), [
    { id: 'action_book', title: '📅 Book Service' },
    { id: 'action_status', title: '📊 My Status' },
    { id: 'action_manage', title: '✏️ Manage Booking' },
  ])

  const alreadyOnboarded = await wasOnboarded(phone)
  if (!alreadyOnboarded) {
    await sendText(phone, BILINGUAL_GREETING)
    await updateSession(phone, { onboardedAt: Date.now() })
  }
}

async function handleManageBookingEntry(phone: string) {
  const lang = (await getSession(phone)).language || 'en'
  await sendButtons(phone, t(lang, 'welcome.manage.body'), [
    { id: 'manage_cancel', title: '❌ Cancel Booking' },
    { id: 'manage_reschedule', title: '🔁 Reschedule' },
  ])
}

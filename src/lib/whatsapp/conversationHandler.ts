import { sendText, sendButtons } from './client'
import { getSession, resetSession, wasOnboarded, updateSession } from './sessionManager'
import { parseIntent } from './intentParser'
import { startBooking, handleServiceTypeSelection, handleVehicleSelection, showPreviousVehiclesMenu, handleBookingTextInput, handleSlotSelection, handleDaySelection, confirmBooking } from './flows/bookingFlow'
import { handleStatusCheck, handleCancelRequest, handleConfirmCancel, handleBookingSelection, handleCancelBookingSelection } from './flows/statusFlow'
import { handleRemindConfirm, handleRemindReschedule, startReschedule, handleRescheduleDaySelection, handleRescheduleSlotSelection } from './flows/reminderActions'

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

    // Treat a missing session as a fresh user — no collecting state to escape.
    const state = session?.state
    if (state === 'COLLECTING_VEHICLE_NUMBER' || state === 'COLLECTING_CUSTOMER_NAME') {
      // Allow the user to escape the data-entry state with control keywords
      // (without this they can be stuck for the session TTL if they entered
      // the flow by mistake and typed something like "cancel" or "menu").
      const lower = text.trim().toLowerCase()
      const escape =
        lower === 'cancel' || lower === 'stop' || lower === 'exit' ||
        lower === 'menu' || lower === 'help' || lower === 'hi' || lower === 'hello' ||
        lower === 'start' || lower === 'book' || lower === 'status'
      if (escape) {
        await resetSession(phone)
        await sendText(phone, `No problem — exited the current step. Reply *book* to start over or *menu* for options. 👋`)
        return
      }
      await handleBookingTextInput(phone, text)
      return
    }

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
        await sendText(phone, `No problem! Reply *book* when you're ready. 😊`)
        break
      case 'HELP':
      default:
        await sendWelcome(phone)
    }
  } catch (err) {
    // Per-message failure MUST not crash the webhook — log + send a soft
    // freeform prompt so the user can try again or re-trigger the menu.
    console.error('[handler] message processing failed:', err)
    try {
      await sendText(phone, `Hmm, something went sideways on my end. Reply *menu* and I'll start fresh. 🙏`)
    } catch {
      // best-effort only; if even this fails, the user is offline anyway
    }
  }
}

async function handleInteractiveReply(phone: string, id: string) {
  try {
    if (id.startsWith('svc_')) { await handleServiceTypeSelection(phone, id); return }
    if (id.startsWith('day_')) { await handleDaySelection(phone, id.replace('day_', '')); return }
    if (id.startsWith('slot_')) { await handleSlotSelection(phone, id); return }
    if (id === 'vehicles_menu') { await showPreviousVehiclesMenu(phone); return }
    if (id.startsWith('vehicle_')) { await handleVehicleSelection(phone, id.replace('vehicle_', '')); return }
    if (id.startsWith('status_booking_')) { await handleBookingSelection(phone, id.replace('status_booking_', '')); return }
    if (id.startsWith('cancel_booking_')) { await handleCancelBookingSelection(phone, id.replace('cancel_booking_', '')); return }
    // Reminder-scoped button IDs (svc_reminder_30m template quick-replies).
    // The bookingId suffix is ignored — the handler always resolves to the
    // customer's latest active booking, since Meta templates have static
    // button payloads shared across all sends of the template.
    if (id.startsWith('remind_confirm')) { await handleRemindConfirm(phone); return }
    if (id.startsWith('remind_reschedule')) { await handleRemindReschedule(phone); return }
    // Reschedule picker (reuses the booking flow's day/slot list but with
    // reschedule_day_/reschedule_slot_ prefixes to disambiguate).
    if (id.startsWith('reschedule_day_')) { await handleRescheduleDaySelection(phone, id.replace('reschedule_day_', '')); return }
    if (id.startsWith('reschedule_slot_')) { await handleRescheduleSlotSelection(phone, id); return }

    switch (id) {
      case 'action_book': await startBooking(phone); break
      case 'action_status': await handleStatusCheck(phone); break
      case 'action_cancel': await handleCancelRequest(phone); break
      case 'action_manage': await handleManageBookingEntry(phone); break
      case 'manage_cancel': await handleCancelRequest(phone); break
      case 'manage_reschedule': await startReschedule(phone); break
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
  } catch (err) {
    console.error('[handler] interactive reply failed:', err)
    try {
      await resetSession(phone)
      await sendText(phone, `Something glitched. Your session is reset — reply *menu* to start over. 🙏`)
    } catch {}
  }
}

async function sendWelcome(phone: string) {
  // Welcome menu — sent on first contact, after session reset, or whenever
  // the user asks for help/menu. Includes both button shortcuts and explicit
  // text commands so users on older WhatsApp versions (no interactive
  // buttons) can still navigate by typing. 3-button cap: Book + Status +
  // "Manage Booking" (which fans out to a Cancel/Reschedule submenu).
  const body =
    `👋 *Welcome to Sharma Bajaj Service Centre!*\n\n` +
    `Your one-stop assistant for bookings, status checks, cancellations, and reschedules.\n\n` +
    `📌 *Quick commands:*\n` +
    `• Say *BOOK* — start a new service booking\n` +
    `• Say *STATUS* — check your active booking\n` +
    `• Say *CANCEL* or *RESCHEDULE* — manage your booking\n\n` +
    `Or tap a button below:`

  // Send the menu FIRST (older bubble, scrolled up), then the
  // onboarding message LAST (newest bubble, bottom of the chat).
  // When the user opens the conversation, the bottom of the chat is
  // what they see first — so the onboarding message is the
  // first-impression greeting. Returning users skip the onboarding
  // text entirely (alreadyOnboarded flag in the session).
  await sendButtons(phone, body, [
    { id: 'action_book', title: '📅 Book Service' },
    { id: 'action_status', title: '📊 My Status' },
    { id: 'action_manage', title: '✏️ Manage Booking' },
  ])

  const alreadyOnboarded = await wasOnboarded(phone)
  if (!alreadyOnboarded) {
    // Combined bilingual greeting in a single bubble so it lands as one
    // chat message at the bottom of the conversation.
    await sendText(
      phone,
      `🙏 *પ્રિય બજાજ થ્રી વ્હીલર પરિવાર,*\n` +
      `હવે સર્વિસ માટે વહેલી સવારે લાઇનમાં ઊભા રહેવાની કે લાંબા સમય સુધી રાહ જોવાની જરૂર નથી.\n` +
      `📅 તમારી ગાડીની સર્વિસ બુક કરવા માટે આ નંબર પર માત્ર "Hi" મોકલો +916358201573 અને તમારી અનુકૂળ તારીખ અને સમય પસંદ કરો.\n` +
      `– શર્મા બજાજ સર્વિસ ટીમ\n\n` +
      `Dear Bajaj Three-Wheeler Vehicle Owners,\n` +
      `Skip the early morning service queue and long waiting times.\n` +
      `📅 Book your vehicle service appointment easily on WhatsApp. Just send "Hi" to this number +916358201573 and choose your preferred service date.\n` +
      `– Sharma Bajaj Service Team`
    )
    await updateSession(phone, { onboardedAt: Date.now() })
  }
}

// "Manage Booking" entry point. Shows a 2-button submenu asking whether
// the user wants to cancel or reschedule. Each sub-action reuses the
// existing cancel / reschedule flows. If the appointment is within
// 30 min, both branches fall through to a Call Workshop reply (handled
// by the per-flow lock check).
async function handleManageBookingEntry(phone: string) {
  const body =
    `What would you like to do with your booking?\n\n` +
    `Tap *Cancel* to cancel, or *Reschedule* to pick a new slot.`
  await sendButtons(phone, body, [
    { id: 'manage_cancel', title: '❌ Cancel Booking' },
    { id: 'manage_reschedule', title: '🔁 Reschedule' },
  ])
}


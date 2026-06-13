/**
 * Bilingual (English / Gujarati) body-text catalog for the WhatsApp bot.
 *
 * SCOPE: only the *body* / long-form text of bot messages is bilingual.
 * Button labels, list row titles, list section titles, and list action-button
 * labels stay English forever and are hardcoded in the flow files. The only
 * exception is the language picker itself, where the 2 button labels are
 * bilingual ("English" / "ગુજરાતી") — that picker is hardcoded in
 * conversationHandler.ts.
 *
 * When a key has `gu: null`, t() falls back to the English string, logs a
 * warning, and appends the key to `translations_pending.md` so the user can
 * fill it in later. The fallback is once-per-key per cold start (de-duped
 * via a Set), so we don't spam the log or the file.
 *
 * Placeholder syntax: `{0}`, `{1}`, ... replaced in order from `...args`.
 */

import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SERVICE_TYPE_LABELS, STATUS_LABELS } from './intentParser'

export type Lang = 'en' | 'gu'

// ─── Key set ──────────────────────────────────────────────────────────────────

export type MessageKey =
  // welcome / menu
  | 'welcome.greeting'
  | 'welcome.menu.body'
  | 'welcome.manage.body'
  | 'lang.picker.body'
  // booking
  | 'booking.service.body'
  | 'booking.vehicle.which'
  | 'booking.vehicle.number_prompt'
  | 'booking.vehicle.example'
  | 'booking.vehicle.selected'
  | 'booking.vehicle.typed'
  | 'booking.name.prompt'
  | 'booking.slots.empty'
  | 'booking.date.empty'
  | 'booking.hour.full'
  | 'booking.hour.invalid'
  | 'booking.hour.day_missing'
  | 'booking.summary.title'
  | 'booking.summary.service'
  | 'booking.summary.vehicle'
  | 'booking.summary.date'
  | 'booking.summary.time'
  | 'booking.summary.confirm'
  | 'booking.confirmed.title'
  | 'booking.confirmed.id'
  | 'booking.confirmed.date'
  | 'booking.confirmed.time'
  | 'booking.confirmed.vehicle'
  | 'booking.confirmed.service'
  | 'booking.confirmed.reminder_note'
  | 'booking.confirmed.status_cta'
  | 'booking.confirmed.cancel_cta'
  | 'booking.confirmed.signoff'
  | 'booking.error'
  // status
  | 'status.no_booking'
  | 'status.no_booking_cta'
  | 'status.no_active'
  | 'status.no_active_cta'
  | 'status.multiple'
  | 'status.more_hint'
  | 'status.cancel_more_hint'
  | 'status.body.title'
  | 'status.body.booking'
  | 'status.body.vehicle'
  | 'status.body.appointment'
  | 'status.body.service'
  | 'status.body.status'
  | 'status.body.reminders_hint'
  | 'status.cancel_prompt'
  | 'status.cancel_locked'
  | 'status.cancel_too_close'
  | 'status.cancel_bookings_empty'
  | 'status.cancel_picker'
  | 'status.cancel_confirm'
  | 'status.cancel_success'
  | 'status.cancel_failed_lookup'
  | 'status.booking_not_found'
  | 'status.picker_help'
  // remind / reschedule
  | 'remind.already_confirmed'
  | 'remind.confirmed'
  | 'remind.reschedule_locked_confirmed'
  | 'remind.too_close'
  | 'remind.no_slots'
  | 'remind.no_booking'
  | 'remind.no_active'
  | 'remind.pick_new_date'
  | 'remind.pick_new_time'
  | 'remind.session_expired'
  | 'remind.slot_not_found'
  | 'remind.booking_not_found_status'
  | 'remind.reschedule_success_title'
  | 'remind.reschedule_success_booking'
  | 'remind.reschedule_success_date'
  | 'remind.reschedule_success_time'
  | 'remind.reschedule_success_footer'
  | 'remind.workshop_call'
  | 'remind.workshop_help'
  | 'remind.workshop_call_suffix'
  | 'remind.workshop_help_suffix'
  | 'customer_record_not_found'
  // generic handler fallbacks
  | 'handler.error.generic'
  | 'handler.error.interactive'
  | 'handler.escape'
  | 'handler.confirm_no'
  | 'handler.cancel_flow'
  | 'handler.keep_booking'
  // list / picker bodies
  | 'date_picker_body'
  | 'hour_picker_body'
  | 'time_picker_body'
  | 'vehicle_picker_body'
  // status labels (used in status body)
  | 'status_label.booked'
  | 'status_label.received'
  | 'status_label.completed'
  | 'status_label.cancelled'
  | 'status_label.no_show'
  // composite full-text messages
  | 'booking.summary.full'
  | 'booking.confirmed.full'
  | 'status.body.full'
  | 'remind.confirmed.full'
  // service type labels (used in summary / confirmation)
  | 'service.free_service'
  | 'service.paid_service'
  | 'service.repair_diagnosis'
  | 'service.emergency'
  | 'service.other'

type Entry = { en: string; gu: string | null }

const MESSAGES: Record<MessageKey, Entry> = {
  // ─── welcome / menu ──────────────────────────────────────────────────────
  'welcome.greeting': {
    en: '',
    gu: '',
  },
  'welcome.menu.body': {
    en:
      `👋 *Welcome to Sharma Bajaj Service Centre!*\n\n` +
      `Your one-stop assistant for bookings, status checks, cancellations, and reschedules.\n\n` +
      `📌 *Quick commands:*\n` +
      `• Say *BOOK* — start a new service booking\n` +
      `• Say *STATUS* — check your active booking\n` +
      `• Say *CANCEL* or *RESCHEDULE* — manage your booking`,
    gu:
      `👋 *શર્મા બજાજ સર્વિસ સેન્ટરમાં આપનું સ્વાગત છે!*\n\n` +
      `બુકિંગ, સ્ટેટસ ચેક, રદ કરવું અને ફરી સુનિશ્ચિત કરવા માટે તમારો સહાયક.\n\n` +
      `📌 *ઝડપી આદેશો:*\n` +
      `• *બુક* કહો — નવી સર્વિસ બુકિંગ શરૂ કરો\n` +
      `• *સ્ટેટસ* કહો — તમારું સક્રિય બુકિંગ તપાસો\n` +
      `• *રદ કરો* અથવા *ફરી સુનિશ્ચિત કરો* કહો — તમારું બુકિંગ મેનેજ કરો`,
  },
  'welcome.manage.body': {
    en: `What would you like to do with your booking?\n\nTap *Cancel* to cancel, or *Reschedule* to pick a new slot.`,
    gu: `તમારે તમારા બુકિંગ સાથે શું કરવું છે?\n\n*રદ કરો* દબાવી રદ કરો, અથવા *ફરી સુનિશ્ચિત કરો* દબાવી નવો સમય પસંદ કરો.`,
  },
  'lang.picker.body': {
    en: `🌐 Choose your language:`,
    gu: `🌐 તમારી ભાષા પસંદ કરો:`,
  },

  // ─── booking ─────────────────────────────────────────────────────────────
  'booking.service.body': {
    en: `Let's get your vehicle booked in 2 minutes\nSelect the type of service you need:`,
    gu: `ચાલો, માત્ર 2 મિનિટમાં તમારા વાહનની સર્વિસ બુક કરીએ.\nતમને કઈ પ્રકારની સર્વિસ જોઈએ છે?`,
  },
  'booking.vehicle.which': {
    en: `Which vehicle?`,
    gu: `કયું વાહન?`,
  },
  'booking.vehicle.number_prompt': {
    en: `Enter your *vehicle registration number*:\n_(Example: TS09AB1234)_`,
    gu: `સર્વિસ માટેના વાહનનો નંબર દાખલ કરો:`,
  },
  'booking.vehicle.example': {
    en: `_(Example: TS09AB1234)_`,
    gu: `_(ઉદાહરણ: TS09AB1234)_`,
  },
  'booking.vehicle.selected': {
    en: `*{0}* selected.`,
    gu: `*{0}* પસંદ કર્યું.`,
  },
  'booking.vehicle.typed': {
    en: `Vehicle: *{0}* ✅`,
    gu: `વાહન: *{0}* ✅`,
  },
  'booking.name.prompt': {
    en: `Now, what is your *full name*?`,
    gu: `તમારું પૂરું નામ દાખલ કરો:`,
  },
  'booking.slots.empty': {
    en: `😔 No slots available in the coming days.\n\nPlease call us directly to book.`,
    gu: `😔 No slots available in the coming days.

Please call us directly to book.`,
  },
  'booking.date.empty': {
    en: `No slots available for that day. Please choose another.`,
    gu: `No slots available for that day. Please choose another.`,
  },
  'booking.hour.full': {
    en: `That hour is now full. Please pick another.`,
    gu: `That hour is now full. Please pick another.`,
  },
  'booking.hour.invalid': {
    en: `Sorry, that selection is invalid. Try again.`,
    gu: `Sorry, that selection is invalid. Try again.`,
  },
  'booking.hour.day_missing': {
    en: `Sorry, day not found. Please choose another.`,
    gu: `Sorry, day not found. Please choose another.`,
  },
  'booking.summary.title': {
    en: `📋 *Booking Summary*`,
    gu: `📋 *બુકિંગ માહિતી*`,
  },
  'booking.summary.service': {
    en: `🔧 Service: {0}`,
    gu: `🔧 સર્વિસ: {0}`,
  },
  'booking.summary.vehicle': {
    en: `🚗 Vehicle: {0} ({1})`,
    gu: `🚗 વાહન: {0} ({1})`,
  },
  'booking.summary.date': {
    en: `📅 Date: {0}`,
    gu: `📅 તારીખ: {0}`,
  },
  'booking.summary.time': {
    en: `⏰ Time: {0}`,
    gu: `⏰ સમય: {0}`,
  },
  'booking.summary.confirm': {
    en: `Confirm this booking?`,
    gu: `શું તમે આ બુકિંગની પુષ્ટિ કરો છો?`,
  },
  'booking.confirmed.title': {
    en: `✅ *Booking Confirmed!*`,
    gu: `✅ *બુકિંગ સફળતાપૂર્વક પુષ્ટિ થયું!*`,
  },
  'booking.confirmed.id': {
    en: `🎫 Booking ID: *{0}*`,
    gu: `🎫 બુકિંગ ID: *{0}*`,
  },
  'booking.confirmed.date': {
    en: `📅 Date: {0}`,
    gu: `📅 તારીખ: {0}`,
  },
  'booking.confirmed.time': {
    en: `⏰ Time: {0}`,
    gu: `⏰ સમય: {0}`,
  },
  'booking.confirmed.vehicle': {
    en: `🚗 Vehicle: {0}`,
    gu: `🚗 વાહન: {0}`,
  },
  'booking.confirmed.service': {
    en: `🔧 Service: {0}`,
    gu: `🔧 સર્વિસ: {0}`,
  },
  'booking.confirmed.reminder_note': {
    en: `We'll send you reminders before your appointment.`,
    gu: `We'll send you reminders before your appointment.`,
  },
  'booking.confirmed.status_cta': {
    en: `To check status, reply: *status*`,
    gu: `સ્ટેટસ તપાસવા માટે જવાબ આપો: status`,
  },
  'booking.confirmed.cancel_cta': {
    en: `To cancel, reply: *cancel*`,
    gu: `બુકિંગ રદ કરવા માટે જવાબ આપો: રદ કરો`,
  },
  'booking.confirmed.signoff': {
    en: `See you on {0}! 🙏`,
    gu: `See you on {0}! 🙏`,
  },
  'booking.error': {
    en: `Sorry, something went wrong. Please try again or call us directly.`,
    gu: `Sorry, something went wrong. Please try again or call us directly.`,
  },

  // ─── status ─────────────────────────────────────────────────────────────
  'status.no_booking': {
    en: `No booking found for this number.\n\nTo book a service, reply *book* or *service*.`,
    gu: `No booking found for this number.

To book a service, reply *book* or *service*.`,
  },
  'status.no_booking_cta': {
    en: `Reply *book* to schedule a service.`,
    gu: `Reply *book* to schedule a service.`,
  },
  'status.no_active': {
    en: `No active booking found, {0}.\n\nTo book a new service, reply *book*.`,
    gu: `યશસ્વી, હાલમાં કોઈ સક્રિય બુકિંગ મળ્યું નથી.\n\nનવી સર્વિસ બુક કરવા માટે જવાબ આપો: બુક`,
  },
  'status.no_active_cta': {
    en: `To book a new service, reply *book*.`,
    gu: `નવી સર્વિસ બુક કરવા માટે જવાબ આપો: બુક`,
  },
  'status.multiple': {
    en: `You have *{0} active bookings*. Which one to check?{1}`,
    gu: `તમારી પાસે {0} સક્રિય બુકિંગ્સ છે. તમે કયું બુકિંગ તપાસવા માંગો છો?{1}`,
  },
  'status.more_hint': {
    en: `\n_Plus {0} more — see them on our website._`,
    gu: `
_Plus {0} more — see them on our website._`,
  },
  'status.cancel_more_hint': {
    en: `\n_Plus {0} more — please call us for those._`,
    gu: `
_Plus {0} more — please call us for those._`,
  },
  'status.body.title': {
    en: `{0} *Service Status*`,
    gu: `{0} *સર્વિસ સ્ટેટસ*`,
  },
  'status.body.booking': {
    en: `🎫 Booking: *{0}*`,
    gu: `🎫 બુકિંગ: *{0}*`,
  },
  'status.body.vehicle': {
    en: `🚗 Vehicle: {0} ({1})`,
    gu: `🚗 વાહન: {0} ({1})`,
  },
  'status.body.appointment': {
    en: `📅 Appointment: {0} @ {1}`,
    gu: `📅 એપોઇન્ટમેન્ટ: {0} @ {1}`,
  },
  'status.body.service': {
    en: `🔧 Service: {0}`,
    gu: `🔧 સર્વિસ: {0}`,
  },
  'status.body.status': {
    en: `🔄 Status: *{0}*`,
    gu: `🔄 સ્ટેટસ: *{0}*`,
  },
  'status.body.reminders_hint': {
    en: `_Reminders will be sent before your appointment._`,
    gu: `🔑 *Service Status*`,
  },
  'status.cancel_prompt': {
    en: `Would you like to cancel this booking?`,
    gu: `શું તમે આ બુકિંગ રદ કરવા માંગો છો?`,
  },
  'status.cancel_locked': {
    en: `⚠️ Cancellations are locked within {0} minutes of your appointment. Please call us to make changes.`,
    gu: `🎫 Booking: *{0}*`,
  },
  'status.cancel_too_close': {
    en: `⚠️ Cannot cancel — appointment is within {0} minutes. Please call us to make changes.`,
    gu: `🚗 Vehicle: {0} ({1})`,
  },
  'status.cancel_bookings_empty': {
    en: `No cancellable booking found. Only *Booked* appointments can be cancelled.`,
    gu: `📅 Appointment: {0} @ {1}`,
  },
  'status.cancel_picker': {
    en: `Which booking to cancel?{0}`,
    gu: `કયું બુકિંગ રદ કરવું છે?{0}`,
  },
  'status.cancel_confirm': {
    en: `Cancel *{0}*?\n📅 {1} @ {2}`,
    gu: `🔧 Service: {0}`,
  },
  'status.cancel_success': {
    en: `✅ Booking *{0}* cancelled.\n\nTo book again, reply *book*. 🙏`,
    gu: `🔄 Status: *{0}*`,
  },
  'status.cancel_failed_lookup': {
    en: `Could not find your booking. Please try again.`,
    gu: `Reminders will be sent before your appointment.`,
  },
  'status.booking_not_found': {
    en: `Booking not found.`,
    gu: `Would you like to cancel this booking?`,
  },
  'status.picker_help': {
    en: `Reply *status* to check again.`,
    gu: `⚠️ Cancellations are locked within {0} minutes of your appointment. Please call us to make changes.`,
  },

  // ─── remind / reschedule ────────────────────────────────────────────────
  'remind.already_confirmed': {
    en: `✅ Already confirmed. See you on {0} at {1}!`,
    gu: `⚠️ Cannot cancel — appointment is within {0} minutes. Please call us to make changes.`,
  },
  'remind.confirmed': {
    en: `✅ Confirmed! Your *{0}* for *{1}* is locked in.\n\n📅 {2} @ {3}\n\nSee you then! 🙏`,
    gu: `No cancellable booking found. Only *Booked* appointments can be cancelled.`,
  },
  'remind.reschedule_locked_confirmed': {
    en: `🔒 This appointment is already confirmed and can't be rescheduled online. To make changes, please call us.`,
    gu: `Which booking to cancel?{0}`,
  },
  'remind.too_close': {
    en: `⚠️ Too close to your appointment (within {0} min). Please call us to reschedule.`,
    gu: `Cancel *{0}*?
📅 {1} @ {2}`,
  },
  'remind.no_slots': {
    en: `😔 No slots available in the coming days. Please call us to reschedule.`,
    gu: `✅ Booking *{0}* cancelled.

To book again, reply *book*. 🙏`,
  },
  'remind.no_booking': {
    en: `No booking found.`,
    gu: `Could not find your booking. Please try again.`,
  },
  'remind.no_active': {
    en: `No active booking found.`,
    gu: `Booking not found.`,
  },
  'remind.pick_new_date': {
    en: `Pick a new date for your appointment:`,
    gu: `Reply *status* to check again.`,
  },
  'remind.pick_new_time': {
    en: `*{0}*\n\nChoose a new time:`,
    gu: `✅ Already confirmed. See you on {0} at {1}!`,
  },
  'remind.session_expired': {
    en: `Reschedule session expired. Reply *reschedule* to start again.`,
    gu: `🔒 This appointment is already confirmed and can't be rescheduled online. To make changes, please call us.`,
  },
  'remind.slot_not_found': {
    en: `Could not locate your current slot. Please call us to reschedule.`,
    gu: `⚠️ Too close to your appointment (within {0} min). Please call us to reschedule.`,
  },
  'remind.booking_not_found_status': {
    en: `Booking not found. Reply *status* to see your active bookings.`,
    gu: `😔 No slots available in the coming days. Please call us to reschedule.`,
  },
  'remind.reschedule_success_title': {
    en: `✅ *Rescheduled!*`,
    gu: `No booking found.`,
  },
  'remind.reschedule_success_booking': {
    en: `🎫 Booking: *{0}*`,
    gu: `No active booking found.`,
  },
  'remind.reschedule_success_date': {
    en: `📅 New date: {0}`,
    gu: `Pick a new date for your appointment:`,
  },
  'remind.reschedule_success_time': {
    en: `⏰ New time: {0}`,
    gu: `*{0}*

Choose a new time:`,
  },
  'remind.reschedule_success_footer': {
    en: `We'll send a fresh reminder before your appointment.`,
    gu: `Reschedule session expired. Reply *reschedule* to start again.`,
  },
  'remind.workshop_call': {
    en: `Need to talk to us? Just long-press this number to call our workshop:\n\n📞 {0}`,
    gu: `Could not locate your current slot. Please call us to reschedule.`,
  },
  'remind.workshop_help': {
    en: `Need to talk to us? Just reply *help* and we will guide you.`,
    gu: `Booking not found. Reply *status* to see your active bookings.`,
  },
  'remind.workshop_call_suffix': {
    en: `\n\n📞 Call us: {0}`,
    gu: `✅ *Rescheduled!*`,
  },
  'remind.workshop_help_suffix': {
    en: `\n\n📞 Please call us to make changes.`,
    gu: `🎫 Booking: *{0}*`,
  },
  'customer_record_not_found': {
    en: `Customer record not found.`,
    gu: `📅 New date: {0}`,
  },

  // ─── generic handler fallbacks ──────────────────────────────────────────
  'handler.error.generic': {
    en: `Hmm, something went sideways on my end. Reply *menu* and I'll start fresh. 🙏`,
    gu: `⏰ New time: {0}`,
  },
  'handler.error.interactive': {
    en: `Something glitched. Your session is reset — reply *menu* to start over. 🙏`,
    gu: `We'll send a fresh reminder before your appointment.`,
  },
  'handler.escape': {
    en: `No problem — exited the current step. Reply *book* to start over or *menu* for options. 👋`,
    gu: `Need to talk to us? Just long-press this number to call our workshop:

📞 {0}`,
  },
  'handler.confirm_no': {
    en: `No problem! Reply *book* when you're ready. 😊`,
    gu: `Need to talk to us? Just reply *help* and we will guide you.`,
  },
  'handler.cancel_flow': {
    en: `No problem. Reply *book* whenever you're ready. 👋`,
    gu: `

📞 Call us: {0}`,
  },
  'handler.keep_booking': {
    en: `Booking kept. See you at your appointment! 👍`,
    gu: `

📞 Please call us to make changes.`,
  },

  // ─── list / picker bodies ───────────────────────────────────────────────
  'date_picker_body': {
    en: `Select a date for your appointment:`,
    gu: `Customer record not found.`,
  },
  'hour_picker_body': {
    en: `*{0}*\n\nPick an hour:`,
    gu: `Hmm, something went sideways on my end. Reply *menu* and I'll start fresh. 🙏`,
  },
  'time_picker_body': {
    en: `*{0} · {1}*\n\nChoose your time:`,
    gu: `Something glitched. Your session is reset — reply *menu* to start over. 🙏`,
  },
  'vehicle_picker_body': {
    en: `Select your vehicle:`,
    gu: `વાહનનું ચુનાવ કરો`,
  },

  // ─── status labels ──────────────────────────────────────────────────────
  'status_label.booked': {
    en: STATUS_LABELS.booked,
    gu: `એપોઇન્ટમેન્ટ પુષ્ટિ થઈ ગઈ છે`,
  },
  'status_label.received': {
    en: STATUS_LABELS.received,
    gu: `વાહન વર્કશોપમાં પ્રાપ્ત થયું`,
  },
  'status_label.completed': {
    en: STATUS_LABELS.completed,
    gu: `No problem — exited the current step. Reply *book* to start over or *menu* for options. 👋`,
  },
  'status_label.cancelled': {
    en: STATUS_LABELS.cancelled,
    gu: `No problem! Reply *book* when you're ready. 😊`,
  },
  'status_label.no_show': {
    en: STATUS_LABELS.no_show,
    gu: `No problem. Reply *book* whenever you're ready. 👋`,
  },

  // ─── service type labels ────────────────────────────────────────────────
  'service.free_service': {
    en: SERVICE_TYPE_LABELS.free_service,
    gu: `Booking kept. See you at your appointment! 👍`,
  },
  'service.paid_service': {
    en: SERVICE_TYPE_LABELS.paid_service,
    gu: `Select a date for your appointment:`,
  },
  'service.repair_diagnosis': {
    en: SERVICE_TYPE_LABELS.repair_diagnosis,
    gu: `*{0}*

Pick an hour:`,
  },
  'service.emergency': {
    en: SERVICE_TYPE_LABELS.emergency,
    gu: `*{0} · {1}*

Choose your time:`,
  },
  'service.other': {
    en: SERVICE_TYPE_LABELS.other,
    gu: `સર્વિસ`,
  },
  // ─── composite full-text messages ──────────────────────────────────
  'booking.summary.full': {
    en: `📋 *Booking Summary*\n\n🔧 Service: {0}\n🚗 Vehicle: {1} ({2})\n📅 Date: {3}\n⏰ Time: {4}\n\nConfirm this booking?`,
    gu: `📋 *બુકિંગ માહિતી*\n\n🔧 સર્વિસ: {0}\n🚗 વાહન: {1} ({2})\n📅 તારીખ: {3}\n⏰ સમય: {4}\n\nશું તમે આ બુકિંગની પુષ્ટિ કરો છો?`,
  },
  'booking.confirmed.full': {
    en: `✅ *Booking Confirmed!*\n\n🎫 Booking ID: *{0}*\n📅 Date: {1}\n⏰ Time: {2}\n🚗 Vehicle: {3}\n🔧 Service: {4}\n\nWe'll send you reminders before your appointment.\n\nTo check status, reply: *status*\nTo cancel, reply: *cancel*\n\nSee you on {5}! 🙏`,
    gu: `✅ *બુકિંગ સફળતાપૂર્વક પુષ્ટિ થયું!*\n\n🎫 બુકિંગ ID: *{0}*\n📅 તારીખ: {1}\n⏰ સમય: {2}\n🚗 વાહન: {3}\n🔧 સર્વિસ: {4}\n\nWe'll send you reminders before your appointment.\n\nસ્ટેટસ તપાસવા માટે જવાબ આપો: status\nબુકિંગ રદ કરવા માટે જવાબ આપો: રદ કરો\n\nSee you on {5}! 🙏`,
  },
  'status.body.full': {
    en: `{0} *Service Status*\n\n🎫 Booking: *{1}*\n🚗 Vehicle: {2} ({3})\n📅 Appointment: {4} @ {5}\n🔧 Service: {6}\n\n🔄 Status: *{7}*`,
    gu: `{0} *સર્વિસ સ્ટેટસ*\n\n🎫 બુકિંગ: *{1}*\n🚗 વાહન: {2} ({3})\n📅 એપોઇન્ટમેન્ટ: {4} @ {5}\n🔧 સર્વિસ: {6}\n\n🔄 સ્થિતિ: *{7}*`,
  },
  'remind.confirmed.full': {
    en: `✅ Confirmed! Your *{0}* for *{1}* is locked in.\n\n📅 {2} @ {3}\n\nSee you then! 🙏`,
    gu: `✅ પુષ્ટિ થઈ! તમારું *{0}* *{1}* માટે નક્કી થઈ ગયું છે.\n\n📅 {2} @ {3}\n\nપછી મળીએ! 🙏`,
  },
}

// ─── Substitution ────────────────────────────────────────────────────────────

function substitute(template: string, args: string[]): string {
  return template.replace(/\{(\d+)\}/g, (m, idx) => {
    const i = Number(idx)
    return i < args.length ? args[i] : m
  })
}

// ─── Fallback tracking ───────────────────────────────────────────────────────

const reportedMissing = new Set<string>()
const PENDING_PATH = join(process.cwd(), 'translations_pending.md')

async function reportMissing(key: MessageKey) {
  if (reportedMissing.has(key)) return
  reportedMissing.add(key)
  console.warn(`[messages] missing gu: ${key}`)
  try {
    await appendFile(PENDING_PATH, `- \`${key}\`\n`, 'utf8')
  } catch (err) {
    // Best-effort. If we can't write the file (e.g. read-only fs in
    // serverless), the warning still surfaced in the log.
    console.error('[messages] could not append translations_pending.md:', err)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function t(lang: Lang, key: MessageKey, ...args: string[]): string {
  const entry = MESSAGES[key]
  if (!entry) {
    console.warn(`[messages] unknown key: ${key}`)
    return ''
  }
  const raw = (lang === 'gu' ? entry.gu : entry.en) ?? entry.en ?? ''
  if (lang === 'gu' && entry.gu === null) {
    void reportMissing(key)
  }
  return substitute(raw, args)
}

export function statusLabelFor(lang: Lang, status: string): string {
  const key = `status_label.${status}` as MessageKey
  return t(lang, key) || status
}

export function serviceTypeLabel(lang: Lang, value: string): string {
  const key = `service.${value}` as MessageKey
  return t(lang, key) || value
}

// Special: the long bilingual greeting block. Always bilingual; sent
// once on first contact, independent of the user's chosen language.
// (User requested Gujarati first, then English.)
export const BILINGUAL_GREETING =
  `🙏 *પ્રિય બજાજ થ્રી વ્હીલર પરિવાર,*\n` +
  `હવે સર્વિસ માટે વહેલી સવારે લાઇનમાં ઊભા રહેવાની કે લાંબા સમય સુધી રાહ જોવાની જરૂર નથી.\n` +
  `📅 તમારી ગાડીની સર્વિસ બુક કરવા માટે આ નંબર પર માત્ર "Hi" મોકલો +916358201573 અને તમારી અનુકૂળ તારીખ અને સમય પસંદ કરો.\n` +
  `– શર્મા બજાજ સર્વિસ ટીમ\n\n` +
  `Dear Bajaj Three-Wheeler Vehicle Owners,\n` +
  `Skip the early morning service queue and long waiting times.\n` +
  `📅 Book your vehicle service appointment easily on WhatsApp. Just send "Hi" to this number +916358201573 and choose your preferred service date.\n` +
  `– Sharma Bajaj Service Team`

/**
 * Per-phone language resolution.
 *
 * The language is stored in two places, in this priority order:
 *   1. `whatsappSession.language` (in-conversation, fast)
 *   2. `customer.language` (cross-session, permanent)
 *
 * No expiry — once a user picks English or Gujarati, that choice sticks
 * forever. There is no auto re-prompt.
 *
 * If neither place has a value, `getUserLanguage` returns `null` and the
 * caller is expected to show the language picker.
 */

import { getSession, updateSession } from './sessionManager'
import { getCustomerByPhone } from '../sanity/queries'
import { setCustomerLanguage } from '../sanity/mutations'
import type { Lang } from './messages'

export type { Lang }

export async function getUserLanguage(phone: string): Promise<Lang | null> {
  // 1. Session
  const session = await getSession(phone)
  if (session.language === 'en' || session.language === 'gu') {
    return session.language
  }
  // 2. Customer doc
  try {
    const customer = await getCustomerByPhone(phone)
    const lang = (customer as unknown as { language?: string } | null)?.language
    if (lang === 'en' || lang === 'gu') {
      // Backfill session so we don't re-query Sanity for every message.
      await updateSession(phone, { language: lang })
      return lang
    }
  } catch (err) {
    console.error('[language] getCustomerByPhone failed:', err)
  }
  return null
}

export async function setUserLanguage(phone: string, lang: Lang): Promise<void> {
  // Mirror to session so the rest of the conversation uses the new lang
  // immediately, even if the customer doc write fails.
  await updateSession(phone, { language: lang })
  // Best-effort persist to customer doc. If the customer doesn't exist
  // yet (they haven't booked), this is a no-op and that's fine — we'll
  // try again next time the customer doc is created/looked up.
  try {
    const customer = await getCustomerByPhone(phone)
    if (customer?._id) {
      await setCustomerLanguage(customer._id, lang)
    }
  } catch (err) {
    console.error('[language] persist to customer failed (non-fatal):', err)
  }
}

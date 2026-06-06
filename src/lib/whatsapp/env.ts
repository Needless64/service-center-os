/**
 * Normalized phone-number helpers for env-driven configuration.
 *
 * `getAgencyPhone` reads `AGENCY_PHONE_NUMBER` from the environment, strips
 * any non-digit characters, and ensures a leading `+` for E.164. Returns
 * `null` if unset or shorter than 11 digits (sanity floor; below this is
 * almost certainly a malformed value rather than a real number).
 */
export function getAgencyPhone(): string | null {
  const raw = process.env.AGENCY_PHONE_NUMBER
  if (!raw) return null
  const cleaned = '+' + raw.replace(/[^0-9]/g, '')
  return cleaned.length >= 11 ? cleaned : null
}

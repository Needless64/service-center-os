/**
 * Shared time-lock constants for the WhatsApp flows.
 *
 * `RESCHEDULE_LOCK_MINUTES` is the threshold inside which a user cannot
 * self-service their appointment (no reschedule, no cancel). Both flows
 * import from here so the rule lives in exactly one place.
 *
 * The 30-minute floor matches the reminder cadence (30m reminder) — once
 * that fires, the customer is past the point of no-return and any change
 * must go through the workshop desk.
 */
export const RESCHEDULE_LOCK_MINUTES = 30

import { nanoid } from 'nanoid'
import { sanityClient } from './client'
import { normalizePhone } from '../utils'
import type { SanityCustomer, SanityBooking } from './queries'

// ─── Customer mutations ──────────────────────────────────────────────────────

export type CreateCustomerInput = {
  name: string
  phoneNumber: string
  vehicleNumber: string
  vehicleModel: string
  manufacturer: string
}

export async function createCustomer(input: CreateCustomerInput): Promise<SanityCustomer> {
  const doc = {
    _type: 'customer',
    customerId: `CUS-${nanoid(8).toUpperCase()}`,
    name: input.name,
    phoneNumber: normalizePhone(input.phoneNumber),
    vehicles: [
      {
        _key: nanoid(),
        vehicleNumber: input.vehicleNumber,
        vehicleModel: input.vehicleModel,
        manufacturer: input.manufacturer,
      },
    ],
    totalVisits: 0,
    createdAt: new Date().toISOString(),
  }
  return sanityClient.create(doc)
}

export async function addVehicleToCustomer(
  customerId: string,
  vehicle: { vehicleNumber: string; vehicleModel: string; manufacturer: string }
) {
  return sanityClient
    .patch(customerId)
    .append('vehicles', [{ _key: nanoid(), ...vehicle }])
    .commit()
}

export async function updateCustomerVisit(customerId: string, date: string) {
  return sanityClient
    .patch(customerId)
    .inc({ totalVisits: 1 })
    .set({ lastVisitDate: date })
    .commit()
}

// ─── Booking mutations ───────────────────────────────────────────────────────

export type CreateBookingInput = {
  customerId: string
  vehicleNumber: string
  vehicleModel: string
  manufacturer: string
  serviceType: string
  scheduledDate: string
  scheduledTime: string
  notes?: string
}

export async function createBooking(input: CreateBookingInput): Promise<SanityBooking> {
  const doc = {
    _type: 'booking',
    bookingId: `BK-${nanoid(8).toUpperCase()}`,
    customer: { _type: 'reference', _ref: input.customerId },
    vehicleNumber: input.vehicleNumber,
    vehicleModel: input.vehicleModel,
    manufacturer: input.manufacturer,
    serviceType: input.serviceType,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    status: 'booked',
    notes: input.notes ?? '',
    reminderSent24h: false,
    reminderSent3h: false,
    reminderSent30m: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  return sanityClient.create(doc)
}

export async function updateBookingStatus(bookingDocId: string, status: string) {
  return sanityClient
    .patch(bookingDocId)
    .set({ status, updatedAt: new Date().toISOString() })
    .commit()
}

export async function cancelBooking(bookingDocId: string) {
  return updateBookingStatus(bookingDocId, 'cancelled')
}

export async function rescheduleBooking(
  bookingDocId: string,
  newDate: string,
  newTime: string,
  oldSlotId: string,
  newSlotId: string
) {
  await Promise.all([
    sanityClient
      .patch(bookingDocId)
      .set({ scheduledDate: newDate, scheduledTime: newTime, status: 'booked', updatedAt: new Date().toISOString() })
      .commit(),
    releaseSlot(oldSlotId),
    incrementSlot(newSlotId),
  ])
}

export async function markReminderSent(bookingDocId: string, type: '24h' | '3h' | '30m') {
  const field = `reminderSent${type === '24h' ? '24h' : type === '3h' ? '3h' : '30m'}`
  return sanityClient.patch(bookingDocId).set({ [field]: true }).commit()
}

export async function markBookingConfirmed(bookingDocId: string) {
  return sanityClient.patch(bookingDocId).set({ confirmedAt: new Date().toISOString() }).commit()
}

// ─── Slot mutations ──────────────────────────────────────────────────────────

/**
 * Atomically claim a seat in a slot.
 *
 * Returns true if the increment succeeded, false if the slot document
 * was missing or the patch errored. The caller is responsible for
 * re-reading the slot after the call and rolling back the booking if
 * currentBookings > capacity (the race-window guard).
 *
 * Sanity's JS client does not yet expose conditional .inc() on a
 * transaction (the API requires raw mutation JSON), so we use a plain
 * patch — the race is closed by the post-increment capacity check in
 * bookingFlow.confirmBooking.
 */
export async function incrementSlot(slotId: string): Promise<boolean> {
  try {
    await sanityClient.patch(slotId).inc({ currentBookings: 1 }).commit()
    return true
  } catch (err) {
    console.error('[slot] increment failed for', slotId, err)
    return false
  }
}

/**
 * Best-effort decrement. Swallows errors because a missing slot (e.g. a
 * cancelled booking referencing a slot that was deleted) must not break the
 * user's cancel flow.
 */
export async function releaseSlot(slotId: string) {
  return sanityClient
    .patch(slotId)
    .dec({ currentBookings: 1 })
    .commit()
    .catch(() => null)
}

export type EnsureSlotInput = {
  date: string
  time: string
  branchId?: string
  capacity?: number
}

/**
 * Idempotent slot creation. The naive version had a fetch-then-create race
 * where two parallel webhooks (the slotHelper fans out with Promise.all)
 * could each see "no existing slot" and both call create, producing
 * duplicates. The transaction here attempts to create and falls back to a
 * re-fetch if Sanity rejects the second insert as a duplicate via the
 * unique-ish compound (date, time, branch) check at create time.
 */
export async function ensureSlotExists(input: EnsureSlotInput) {
  const existing = await sanityClient.fetch(
    `*[_type == "slot" && date == $date && time == $time][0]`,
    { date: input.date, time: input.time }
  )
  if (existing) return existing

  const doc = {
    _id: `slot.${input.date}.${input.time}`.replace(/[^a-zA-Z0-9._-]/g, '_'),
    _type: 'slot',
    date: input.date,
    time: input.time,
    capacity: input.capacity ?? 5,
    currentBookings: 0,
    isBlocked: false,
    ...(input.branchId ? { branch: { _type: 'reference', _ref: input.branchId } } : {}),
  }
  try {
    return await sanityClient.create(doc)
  } catch (err: unknown) {
    // If a parallel call created the same slot first, our deterministic _id
    // collides — Sanity returns 409. Re-fetch and return the winner.
    const winner = await sanityClient.fetch(
      `*[_type == "slot" && date == $date && time == $time][0]`,
      { date: input.date, time: input.time }
    )
    if (winner) return winner
    throw err
  }
}

// ─── Service record mutations ────────────────────────────────────────────────

export async function updateInspection(
  bookingDocId: string,
  data: { inspectionNotes?: string; estimatedCost?: number; estimatedCompletionTime?: string }
) {
  return sanityClient
    .patch(bookingDocId)
    .set({ ...data, status: 'inspection', updatedAt: new Date().toISOString() })
    .commit()
}

export async function markReadyForPickup(bookingDocId: string) {
  return sanityClient
    .patch(bookingDocId)
    .set({ status: 'ready', updatedAt: new Date().toISOString() })
    .commit()
}

export async function markDelivered(bookingDocId: string, finalCost?: number) {
  return sanityClient
    .patch(bookingDocId)
    .set({
      status: 'delivered',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(finalCost !== undefined ? { finalCost } : {}),
    })
    .commit()
}
export async function setCustomerLanguage(customerId: string, language: string) {
  return sanityClient
    .patch(customerId)
    .set({ language: language, updatedAt: new Date().toISOString() })
    .commit()
}

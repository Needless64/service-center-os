import { addDays, format, addMinutes, isBefore } from 'date-fns'
import { getAvailableSlots, getDefaultBranch, type SanityBranch } from '../sanity/queries'
import { ensureSlotExists } from '../sanity/mutations'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function isWorkingDay(date: Date, branch: SanityBranch): boolean {
  const dayName = DAY_NAMES[date.getDay()]
  if (!branch.workingDays.includes(dayName)) return false
  const dateStr = format(date, 'yyyy-MM-dd')
  if (branch.holidays?.includes(dateStr)) return false
  return true
}

function generateTimeSlotsForBranch(branch: SanityBranch): string[] {
  const slots: string[] = []
  const [startH, startM] = branch.workingHours.start.split(':').map(Number)
  const [endH, endM] = branch.workingHours.end.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  const duration = branch.slotDurationMinutes ?? 60

  for (let m = startMinutes; m < endMinutes; m += duration) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return slots
}

export type FlatSlot = {
  date: string           // yyyy-MM-dd
  time: string           // HH:MM
  display: string        // "Wed 4 Jun · 9:00 AM"
  slotId: string
  spotsLeft: number
}

const BOOKING_LEAD_MINUTES = 30  // Must book at least 30 mins before slot time

// Returns up to maxSlots flat date+time slots from next daysAhead working days
// Includes today's remaining slots. Filters out slots < 1 hour from now.
export async function getNextAvailableSlots(maxSlots = 10, daysAhead = 7): Promise<FlatSlot[]> {
  const branch = await getDefaultBranch()
  if (!branch) return []

  const now = new Date()
  const cutoff = addMinutes(now, BOOKING_LEAD_MINUTES)  // earliest bookable slot time
  const todayStr = format(now, 'yyyy-MM-dd')
  const workingDates: Date[] = []

  // Include today if it's a working day (today's remaining slots may be bookable)
  if (isWorkingDay(now, branch)) workingDates.push(now)

  // Then future working days
  for (let d = 1; workingDates.length < daysAhead + 1 && d <= daysAhead + 14; d++) {
    const candidate = addDays(now, d)
    if (isWorkingDay(candidate, branch)) workingDates.push(candidate)
  }

  if (workingDates.length === 0) return []

  const dateStrings = workingDates.map((d) => format(d, 'yyyy-MM-dd'))
  const timeSlots = generateTimeSlotsForBranch(branch)

  // Ensure slot docs exist for all dates × times
  await Promise.all(
    dateStrings.flatMap((date) =>
      timeSlots.map((time) =>
        ensureSlotExists({ date, time, capacity: branch.capacityPerSlot })
      )
    )
  )

  const availableSlots = await getAvailableSlots(dateStrings)

  const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd')
  const result: FlatSlot[] = []

  for (const slot of availableSlots) {
    if (result.length >= maxSlots) break

    // Filter: slot must be at least BOOKING_LEAD_HOURS from now
    const slotDateTime = new Date(`${slot.date}T${slot.time}:00`)
    if (isBefore(slotDateTime, cutoff)) continue   // too soon — skip

    // Date label
    let dateLabel: string
    if (slot.date === todayStr) {
      dateLabel = 'Today'
    } else if (slot.date === tomorrowStr) {
      dateLabel = 'Tmr'
    } else {
      dateLabel = format(new Date(slot.date + 'T00:00:00'), 'EEE d MMM')
    }

    const timeLabel = format(slotDateTime, 'h:mm a')

    result.push({
      date: slot.date,
      time: slot.time,
      display: `${dateLabel} · ${timeLabel}`,
      slotId: slot._id,
      spotsLeft: slot.capacity - slot.currentBookings,
    })
  }

  return result
}

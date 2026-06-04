import { addDays, format, addMinutes, getDay } from 'date-fns'
import { getAvailableSlots, getDefaultBranch, type SanityBranch } from '../sanity/queries'
import { ensureSlotExists } from '../sanity/mutations'

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const BOOKING_LEAD_MINUTES = 30
// IST offset: UTC+5:30 = 330 minutes
const IST_OFFSET_MINUTES = 330

/** Current time in IST */
function nowIST(): Date {
  const utc = new Date()
  return new Date(utc.getTime() + IST_OFFSET_MINUTES * 60 * 1000)
}

/** Parse a slot date+time as IST, return as JS Date in UTC */
function slotDateTimeIST(date: string, time: string): Date {
  // Treat date+time as IST by appending +05:30
  return new Date(`${date}T${time}:00+05:30`)
}

function isWorkingDay(date: Date, branch: SanityBranch): boolean {
  const dayName = DAY_NAMES[getDay(date)]
  if (!branch.workingDays.includes(dayName)) return false
  const dateStr = format(date, 'yyyy-MM-dd')
  if (branch.holidays?.includes(dateStr)) return false
  return true
}

function generateTimeSlotsForBranch(branch: SanityBranch): string[] {
  const slots: string[] = []
  const [sh, sm] = branch.workingHours.start.split(':').map(Number)
  const [eh, em] = branch.workingHours.end.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin   = eh * 60 + em
  const duration = branch.slotDurationMinutes ?? 60
  for (let m = startMin; m < endMin; m += duration) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`)
  }
  return slots
}

export type DaySlots = {
  date: string          // yyyy-MM-dd
  dayLabel: string      // "Tomorrow · Thu 5 Jun"
  slots: {
    time: string        // HH:MM
    display: string     // "9:00 AM"
    slotId: string
    spotsLeft: number
  }[]
}

export async function getAvailableDays(daysAhead = 7): Promise<DaySlots[]> {
  const branch = await getDefaultBranch()
  if (!branch) return []

  const nowIst = nowIST()
  const cutoff = addMinutes(nowIst, BOOKING_LEAD_MINUTES)
  const todayStr = format(nowIst, 'yyyy-MM-dd')
  const tomorrowStr = format(addDays(nowIst, 1), 'yyyy-MM-dd')

  // Collect candidate working dates (include today if has future slots)
  const workingDates: Date[] = []
  for (let d = 0; workingDates.length < daysAhead && d <= daysAhead + 14; d++) {
    const candidate = addDays(nowIst, d)
    if (isWorkingDay(candidate, branch)) {
      workingDates.push(candidate)
    }
  }

  if (workingDates.length === 0) return []

  const dateStrings = workingDates.map((d) => format(d, 'yyyy-MM-dd'))
  const times = generateTimeSlotsForBranch(branch)

  // Ensure slot docs exist
  await Promise.all(
    dateStrings.flatMap((date) =>
      times.map((time) => ensureSlotExists({ date, time, capacity: branch.capacityPerSlot }))
    )
  )

  const availableSlots = await getAvailableSlots(dateStrings)

  const result: DaySlots[] = []

  for (const dateStr of dateStrings) {
    const daySlots = availableSlots
      .filter((s) => s.date === dateStr)
      .filter((s) => {
        // Filter past slots using IST comparison
        const slotDT = slotDateTimeIST(s.date, s.time)
        return slotDT > cutoff
      })
      .map((s) => ({
        time: s.time,
        display: format(new Date(`2000-01-01T${s.time}`), 'h:mm a'),
        slotId: s._id,
        spotsLeft: s.capacity - s.currentBookings,
      }))

    if (daySlots.length === 0) continue

    const dateObj = new Date(dateStr + 'T00:00:00+05:30')
    let dayLabel: string
    if (dateStr === todayStr) {
      dayLabel = `Today · ${format(dateObj, 'EEE d MMM')}`
    } else if (dateStr === tomorrowStr) {
      dayLabel = `Tomorrow · ${format(dateObj, 'EEE d MMM')}`
    } else {
      dayLabel = format(dateObj, 'EEE d MMM')
    }

    result.push({ date: dateStr, dayLabel, slots: daySlots })
  }

  return result
}

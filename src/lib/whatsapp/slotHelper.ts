import { addDays, format, addMinutes, getDay } from 'date-fns'
import { getAvailableSlots, getDefaultBranch, type SanityBranch } from '../sanity/queries'
import { ensureSlotExists } from '../sanity/mutations'

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const BOOKING_LEAD_MINUTES = 30
// IST offset: UTC+5:30 = 330 minutes
/** Get current date string in IST (YYYY-MM-DD) — reliable on any server timezone */
function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

/** Get IST datetime as UTC-epoch Date (for cutoff comparisons with date-fns) */
function nowISTasDate(): Date {
  const istStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  return new Date(istStr)
}

/** Parse slot date+time as IST */
function slotDateTimeIST(date: string, time: string): Date {
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

  const nowIst = nowISTasDate()
  const cutoff = addMinutes(nowIst, BOOKING_LEAD_MINUTES)
  const todayStr = todayIST()
  const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
    .format(addDays(new Date(), 1))

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

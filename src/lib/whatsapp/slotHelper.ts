import { addDays, format, getDay } from 'date-fns'
import { getAvailableSlots, getDefaultBranch, type SanityBranch } from '../sanity/queries'
import { ensureSlotExists } from '../sanity/mutations'

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const BOOKING_LEAD_MINUTES = 30

/** IST date string for any UTC timestamp — YYYY-MM-DD */
function toISTDate(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(ms))
}

/** Day-of-week index for an IST date string */
function dayOfWeekIST(dateStr: string): number {
  return getDay(new Date(`${dateStr}T12:00:00+05:30`))
}

function generateTimes(start: string, end: string, duration: number): string[] {
  const times: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin   = eh * 60 + em
  for (let m = startMin; m < endMin; m += duration) {
    const h = Math.floor(m / 60)
    const min = m % 60
    times.push(`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`)
  }
  return times
}

function isWorkingDay(dateStr: string, branch: SanityBranch): boolean {
  const dayName = DAY_NAMES[dayOfWeekIST(dateStr)]
  if (!branch.workingDays.includes(dayName)) return false
  if (branch.holidays?.includes(dateStr)) return false
  return true
}

export type DaySlots = {
  date: string
  dayLabel: string   // "Today · Thu 4 Jun" / "Tomorrow · Fri 5 Jun" / "Sat 6 Jun"
  slots: { time: string; display: string; slotId: string; spotsLeft: number }[]
}

export async function getAvailableDays(daysAhead = 7): Promise<DaySlots[]> {
  const branch = await getDefaultBranch()
  if (!branch) return []

  // Cutoff = now + 30 min (pure UTC ms — works on any server timezone)
  const cutoffMs = Date.now() + BOOKING_LEAD_MINUTES * 60 * 1000

  const todayStr    = toISTDate(Date.now())
  const tomorrowStr = toISTDate(Date.now() + 86400000)

  // Collect working date strings in IST
  const dateStrings: string[] = []
  for (let d = 0; dateStrings.length < daysAhead && d <= daysAhead + 14; d++) {
    const dateStr = toISTDate(Date.now() + d * 86400000)
    if (isWorkingDay(dateStr, branch)) dateStrings.push(dateStr)
  }

  if (dateStrings.length === 0) return []

  const times = generateTimes(
    branch.workingHours.start,
    branch.workingHours.end,
    branch.slotDurationMinutes ?? 60
  )

  // Ensure slot docs exist
  await Promise.all(
    dateStrings.flatMap((date) =>
      times.map((time) => ensureSlotExists({ date, time, capacity: branch.capacityPerSlot }))
    )
  )

  const available = await getAvailableSlots(dateStrings)

  const result: DaySlots[] = []

  for (const dateStr of dateStrings) {
    const daySlots = available
      .filter((s) => s.date === dateStr)
      .filter((s) => {
        // Slot UTC epoch — parsed with +05:30 so it's correct regardless of server TZ
        const slotMs = new Date(`${s.date}T${s.time}:00+05:30`).getTime()
        return slotMs > cutoffMs
      })
      .map((s) => ({
        time: s.time,
        display: format(new Date(`2000-01-01T${s.time}`), 'h:mm a'),
        slotId: s._id,
        spotsLeft: s.capacity - s.currentBookings,
      }))

    if (daySlots.length === 0) continue

    // Build readable label with date included
    const dateObj = new Date(`${dateStr}T12:00:00+05:30`)
    // Title shown in list AND sent as user's message — keep aesthetic, ≤24 chars
    // "Today · Thu 4 June 2026" = 23 chars ✓
    // "Fri 5 June 2026" = 15 chars ✓
    const fullDate = format(dateObj, 'd MMMM yyyy')   // "4 June 2026"
    const dayLabel =
      dateStr === todayStr    ? `Today · ${format(dateObj, 'EEE')} ${fullDate}`.slice(0, 24) :
      dateStr === tomorrowStr ? `Tmr · ${format(dateObj, 'EEE')} ${fullDate}`.slice(0, 24) :
                                `${format(dateObj, 'EEE')} ${fullDate}`.slice(0, 24)

    result.push({ date: dateStr, dayLabel, slots: daySlots })
  }

  return result
}
// touch Fri Jun  5 20:53:03 IST 2026

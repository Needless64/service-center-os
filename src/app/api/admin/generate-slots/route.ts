import { NextResponse } from 'next/server'
import { sanityClient } from '@/lib/sanity/client'
import { getDefaultBranch } from '@/lib/sanity/queries'
import { addDays, format, getDay } from 'date-fns'

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function generateTimes(start: string, end: string, durationMin: number): string[] {
  const times: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin   = eh * 60 + em
  for (let m = startMin; m < endMin; m += durationMin) {
    const h = Math.floor(m / 60)
    const min = m % 60
    times.push(`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`)
  }
  return times
}

// POST /api/admin/generate-slots  — idempotent, safe to call repeatedly
export async function POST() {
  const branch = await getDefaultBranch()
  if (!branch) return NextResponse.json({ error: 'No branch configured' }, { status: 400 })

  const { workingDays, workingHours, slotDurationMinutes, capacityPerSlot, holidays = [] } = branch
  const times = generateTimes(workingHours.start, workingHours.end, slotDurationMinutes ?? 60)
  const capacity = capacityPerSlot ?? 10
  const today = new Date()
  const daysAhead = 90

  // Collect target date+time pairs
  const targets: { date: string; time: string }[] = []
  for (let d = 0; d <= daysAhead; d++) {
    const day = addDays(today, d)
    const dateStr = format(day, 'yyyy-MM-dd')
    const dayName = DAY_NAMES[getDay(day)]
    if (!workingDays.includes(dayName)) continue
    if (holidays.includes(dateStr)) continue
    for (const time of times) {
      targets.push({ date: dateStr, time })
    }
  }

  // Fetch existing slots for this range in one query
  const startDate = format(today, 'yyyy-MM-dd')
  const endDate   = format(addDays(today, daysAhead), 'yyyy-MM-dd')
  const existing: { date: string; time: string }[] = await sanityClient.fetch(
    `*[_type == "slot" && date >= $start && date <= $end]{ date, time }`,
    { start: startDate, end: endDate }
  )
  const existingSet = new Set(existing.map((s) => `${s.date}_${s.time}`))

  // Only create missing ones
  const missing = targets.filter((t) => !existingSet.has(`${t.date}_${t.time}`))

  // Batch create in groups of 50
  let created = 0
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50)
    await Promise.all(
      batch.map((t) =>
        sanityClient.create({
          _type: 'slot',
          date: t.date,
          time: t.time,
          capacity,
          currentBookings: 0,
          isBlocked: false,
        })
      )
    )
    created += batch.length
  }

  return NextResponse.json({ created, total: targets.length, skipped: targets.length - created })
}

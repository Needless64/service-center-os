import { NextRequest, NextResponse } from 'next/server'
import { sanityClient } from '@/lib/sanity/client'

// GET /api/admin/slots?date=yyyy-MM-dd — all slot docs for a specific date
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  const slots = await sanityClient.fetch(
    `*[_type == "slot" && date == $date] | order(time asc){ _id, date, time, capacity, currentBookings, isBlocked }`,
    { date }
  )
  return NextResponse.json(slots)
}

// POST /api/admin/slots — regenerate slots for a day with new duration + capacity
// Deletes 0-booking slots, creates new ones based on duration, keeps booked slots
export async function POST(req: NextRequest) {
  try {
    const { date, capacity, slotDurationMinutes, startTime, endTime } = await req.json()
    if (!date || !capacity || !slotDurationMinutes || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }

    // Generate target time slots
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const startMin = sh * 60 + sm
    const endMin = eh * 60 + em
    const targetTimes: string[] = []
    for (let m = startMin; m < endMin; m += slotDurationMinutes) {
      const h = Math.floor(m / 60)
      const min = m % 60
      targetTimes.push(`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`)
    }

    // Get existing slots
    const existing: { _id: string; time: string; currentBookings: number }[] =
      await sanityClient.fetch(`*[_type == "slot" && date == $date]{ _id, time, currentBookings }`, { date })

    const existingByTime = new Map(existing.map((s) => [s.time, s]))

    // Delete slots not in new target times AND have 0 bookings
    const toDelete = existing.filter((s) => !targetTimes.includes(s.time) && s.currentBookings === 0)
    if (toDelete.length > 0) {
      await Promise.all(toDelete.map((s) => sanityClient.delete(s._id)))
    }

    // Create or update target slots
    await Promise.all(
      targetTimes.map(async (time) => {
        const ex = existingByTime.get(time)
        if (ex) {
          // Exists — just update capacity (don't go below current bookings)
          await sanityClient.patch(ex._id).set({ capacity: Math.max(capacity, ex.currentBookings) }).commit()
        } else {
          // New slot
          await sanityClient.create({ _type: 'slot', date, time, capacity, currentBookings: 0, isBlocked: false })
        }
      })
    )

    return NextResponse.json({ success: true, slots: targetTimes.length })
  } catch (err) {
    console.error('[admin/slots POST]', err)
    return NextResponse.json({ error: 'Regeneration failed' }, { status: 500 })
  }
}

// PATCH /api/admin/slots
// Single slot: { slotId, capacity }
// All slots on a day: { date, capacity }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { capacity } = body

    if (typeof capacity !== 'number' || capacity < 1) {
      return NextResponse.json({ error: 'Invalid capacity' }, { status: 400 })
    }

    // ── Bulk: update ALL slots on a date ──────────────────────────────────
    if (body.date && !body.slotId) {
      const slots: { _id: string; currentBookings: number }[] = await sanityClient.fetch(
        `*[_type == "slot" && date == $date]{ _id, currentBookings }`,
        { date: body.date }
      )
      // Update each slot — skip any where capacity < currentBookings
      await Promise.all(
        slots.map((s) => {
          const safeCap = Math.max(capacity, s.currentBookings)
          return sanityClient.patch(s._id).set({ capacity: safeCap }).commit()
        })
      )
      return NextResponse.json({ success: true, updated: slots.length })
    }

    // ── Single slot ───────────────────────────────────────────────────────
    if (!body.slotId) return NextResponse.json({ error: 'Missing slotId or date' }, { status: 400 })

    const slot = await sanityClient.fetch(`*[_id == $id][0]{ currentBookings }`, { id: body.slotId })
    if (slot && capacity < slot.currentBookings) {
      return NextResponse.json({
        error: `Cannot set below current bookings (${slot.currentBookings})`
      }, { status: 400 })
    }

    await sanityClient.patch(body.slotId).set({ capacity }).commit()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/slots PATCH]', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

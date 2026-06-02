import { NextRequest, NextResponse } from 'next/server'
import { sanityClient } from '@/lib/sanity/client'

// GET /api/calendar?month=2026-06
// Returns per-date aggregate: { "2026-06-03": { total: 90, booked: 45 }, ... }
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  const data = await sanityClient.fetch(
    `{
      "slots": *[_type == "slot" && date >= $start && date <= $end]{
        date, capacity, currentBookings
      },
      "bookings": *[_type == "booking" && scheduledDate >= $start && scheduledDate <= $end]{
        _id, bookingId, scheduledDate, scheduledTime, vehicleNumber, serviceType, status,
        customer->{ name, phoneNumber }
      }
    }`,
    { start: `${month}-01`, end: `${month}-31` }
  )

  // Aggregate slots by date
  const byDate: Record<string, { totalCapacity: number; booked: number; bookingCount: number }> = {}
  for (const s of data.slots) {
    if (!byDate[s.date]) byDate[s.date] = { totalCapacity: 0, booked: 0, bookingCount: 0 }
    byDate[s.date].totalCapacity += s.capacity
    byDate[s.date].booked += s.currentBookings
  }
  for (const b of data.bookings) {
    if (!byDate[b.scheduledDate]) byDate[b.scheduledDate] = { totalCapacity: 0, booked: 0, bookingCount: 0 }
    byDate[b.scheduledDate].bookingCount++
  }

  return NextResponse.json({ byDate, bookings: data.bookings })
}

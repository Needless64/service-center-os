import { NextRequest, NextResponse } from 'next/server'
import { sanityClient } from '@/lib/sanity/client'
import { format } from 'date-fns'

// GET /api/admin/analytics?from=yyyy-MM-dd&to=yyyy-MM-dd
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') ?? format(new Date(), 'yyyy-MM-dd')
  const to   = req.nextUrl.searchParams.get('to')   ?? format(new Date(), 'yyyy-MM-dd')

  const data = await sanityClient.fetch(
    `{
      "bookings": *[_type == "booking" && scheduledDate >= $from && scheduledDate <= $to] {
        _id, scheduledDate, scheduledTime, serviceType, status,
        customer->{ _id, createdAt }
      },
      "newCustomers": count(*[_type == "customer" && createdAt >= $fromFull && createdAt <= $toFull]),
      "totalCustomers": count(*[_type == "customer"])
    }`,
    { from, to, fromFull: `${from}T00:00:00Z`, toFull: `${to}T23:59:59Z` }
  )

  const bookings = data.bookings ?? []
  const total = bookings.length
  const completed = bookings.filter((b: { status: string }) => b.status === 'completed').length
  const cancelled = bookings.filter((b: { status: string }) => b.status === 'cancelled').length
  const noShow    = bookings.filter((b: { status: string }) => b.status === 'no_show').length
  const received  = bookings.filter((b: { status: string }) => b.status === 'received').length
  const booked    = bookings.filter((b: { status: string }) => b.status === 'booked').length

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0
  const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0

  // Service breakdown
  const serviceCount: Record<string, number> = {}
  for (const b of bookings) {
    serviceCount[b.serviceType] = (serviceCount[b.serviceType] ?? 0) + 1
  }
  const topService = Object.entries(serviceCount).sort((a, b) => b[1] - a[1])[0]

  // Peak hour
  const hourCount: Record<number, number> = {}
  for (const b of bookings) {
    const h = parseInt(b.scheduledTime?.split(':')[0] ?? '0')
    hourCount[h] = (hourCount[h] ?? 0) + 1
  }
  const peakEntry = Object.entries(hourCount).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
  const peakHour = peakEntry ? `${peakEntry[0]}:00` : null

  // Bookings per day
  const byDay: Record<string, number> = {}
  for (const b of bookings) {
    byDay[b.scheduledDate] = (byDay[b.scheduledDate] ?? 0) + 1
  }
  const busiest = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]

  return NextResponse.json({
    total, completed, cancelled, noShow, received, booked,
    completionRate, cancellationRate, noShowRate,
    topService: topService ? { type: topService[0], count: topService[1] } : null,
    peakHour,
    busiestDay: busiest ? { date: busiest[0], count: busiest[1] } : null,
    newCustomers: data.newCustomers ?? 0,
    serviceBreakdown: serviceCount,
    byDay,
  })
}

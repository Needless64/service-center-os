import { NextRequest, NextResponse } from 'next/server'
import { syncBookingsToSheets, syncDailySchedule, syncAnalytics } from '@/lib/sheets/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  try {
    const [bookingCount, dailyCount] = await Promise.all([
      syncBookingsToSheets(),
      syncDailySchedule(today),
    ])

    await syncAnalytics(monthStart, monthEnd)

    return NextResponse.json({ success: true, bookingCount, dailyCount })
  } catch (err) {
    console.error('[sheets sync]', err)
    return NextResponse.json({ error: 'Sync failed', detail: String(err) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getUpcomingBookingsForReminders } from '@/lib/sanity/queries'
import { markReminderSent } from '@/lib/sanity/mutations'
import { sendReminder, shouldSendReminder } from '@/lib/whatsapp/flows/reminderFlow'
import { format } from 'date-fns'

// Called by Vercel Cron every 30 minutes.
// Also callable manually: GET /api/cron/reminders  (with CRON_SECRET header)
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')

  const bookings = await getUpcomingBookingsForReminders(today)
  const results: { bookingId: string; type: string; sent: boolean }[] = []

  for (const booking of bookings) {
    const phone = (booking.customer as unknown as { phoneNumber?: string })?.phoneNumber
    if (!phone) continue

    for (const type of ['24h', '3h', '30m'] as const) {
      if (shouldSendReminder(booking, type, now)) {
        try {
          await sendReminder(booking, phone, type)
          await markReminderSent(booking._id, type)
          results.push({ bookingId: booking.bookingId, type, sent: true })
        } catch (err) {
          console.error(`[cron] Reminder ${type} failed for ${booking.bookingId}:`, err)
          results.push({ bookingId: booking.bookingId, type, sent: false })
        }
      }
    }
  }

  return NextResponse.json({ processed: bookings.length, reminders: results })
}

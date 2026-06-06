import { NextRequest, NextResponse } from 'next/server'
import { getUpcomingBookingsForReminders } from '@/lib/sanity/queries'
import { markReminderSent } from '@/lib/sanity/mutations'
import { sendReminder } from '@/lib/whatsapp/flows/reminderFlow'
import { format, differenceInMinutes } from 'date-fns'

// Called by the GitHub Actions workflow every 5 minutes.
// Sends a single 1h-before reminder to each booked ticket that has not
// already received a reminder. Wider catch: fires when the appointment
// is 30–90 min away so a missed cron tick still picks up the reminder
// in the next pass.
//
// The route no longer branches on reminder type (24h/3h/30m) — the
// `getUpcomingBookingsForReminders` query pre-filters out anything
// where ANY reminderSent* flag is true, so a ticket is picked up at
// most once.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')

  const bookings = await getUpcomingBookingsForReminders(today)
  const results: { bookingId: string; minutesUntil: number; sent: boolean }[] = []

  for (const booking of bookings) {
    const phone = (booking.customer as unknown as { phoneNumber?: string })?.phoneNumber
    if (!phone) continue

    const minutesUntil = differenceInMinutes(
      new Date(`${booking.scheduledDate}T${booking.scheduledTime}:00+05:30`),
      now
    )

    // 1h-before window: 30–90 min ahead. The "wider catch" bounds are
    // intentional so a single missed cron tick still picks up the
    // reminder. Tighten to 55–65 if you want stricter 1h-locked
    // delivery.
    if (minutesUntil < 30 || minutesUntil > 90) continue

    try {
      await sendReminder(booking, phone, '1h')
      // Mark all three flags so a re-run after a partial failure
      // doesn't re-send. The 1h branch is the only one that fires
      // now, so all three flags share the same lifecycle.
      await markReminderSent(booking._id, '24h')
      await markReminderSent(booking._id, '3h')
      await markReminderSent(booking._id, '30m')
      results.push({ bookingId: booking.bookingId, minutesUntil, sent: true })
    } catch (err) {
      console.error(`[cron] Reminder 1h failed for ${booking.bookingId}:`, err)
      results.push({ bookingId: booking.bookingId, minutesUntil, sent: false })
    }
  }

  return NextResponse.json({ processed: bookings.length, sent: results.length, reminders: results })
}

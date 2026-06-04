import { CalendarView } from '@/components/admin/CalendarView'
import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel'

export const dynamic = 'force-dynamic'

// Auto-generate slots for next 90 working days on every calendar load
async function ensureSlots() {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/generate-slots`, {
      method: 'POST',
      cache: 'no-store',
    })
  } catch {}
}

export default async function AdminCalendarPage() {
  await ensureSlots()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-sm text-gray-500 mt-1">
          Slot availability at a glance. Click any date to view bookings and manage slot capacity.
        </p>
      </div>
      <CalendarView />
      <AnalyticsPanel />
    </div>
  )
}

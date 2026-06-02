import { CalendarView } from '@/components/admin/CalendarView'

export const dynamic = 'force-dynamic'

export default function AdminCalendarPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-sm text-gray-500 mt-1">
          Slot availability at a glance. Click any date to view bookings and manage slot capacity.
        </p>
      </div>
      <CalendarView />
    </div>
  )
}

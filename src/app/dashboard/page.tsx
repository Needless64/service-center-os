import { getTodayDashboard } from '@/lib/sanity/queries'
import { KanbanBoard } from '@/components/dashboard/KanbanBoard'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { bookings, slots } = await getTodayDashboard(today)

  const total = bookings.length
  const booked = bookings.filter((b: { status: string }) => b.status === 'booked').length
  const received = bookings.filter((b: { status: string }) => b.status === 'received').length
  const completed = bookings.filter((b: { status: string }) => b.status === 'completed').length
  const cancelled = bookings.filter((b: { status: string }) => ['cancelled','no_show'].includes(b.status)).length

  const totalCapacity = slots.reduce((s: number, sl: { capacity: number }) => s + sl.capacity, 0)
  const occupied = slots.reduce((s: number, sl: { currentBookings: number }) => s + sl.currentBookings, 0)
  const availableSlots = totalCapacity - occupied

  const todayLabel = format(new Date(), 'EEEE, d MMMM yyyy')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today&apos;s Workshop</h1>
          <p className="text-sm text-gray-500 mt-0.5">{todayLabel}</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p><span className="font-semibold text-gray-900">{availableSlots}</span> slots open</p>
          <p><span className="font-semibold text-gray-900">{totalCapacity}</span> total today</p>
        </div>
      </div>

      {/* Quick stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, color: 'bg-slate-50 border-slate-200 text-slate-700' },
          { label: 'Waiting', value: booked, color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'In Workshop', value: received, color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
          { label: 'Done', value: completed, color: 'bg-green-50 border-green-200 text-green-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 text-center ${s.color}`}>
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5 opacity-70 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <KanbanBoard bookings={bookings} />
    </div>
  )
}

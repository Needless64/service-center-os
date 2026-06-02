import { getAnalytics } from '@/lib/sanity/queries'
import { StatCard } from '@/components/dashboard/StatCard'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')
  const lastMonthStart = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
  const lastMonthEnd = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')

  const [current, previous] = await Promise.all([
    getAnalytics(monthStart, monthEnd),
    getAnalytics(lastMonthStart, lastMonthEnd),
  ])

  const completionRate = current.totalBookings > 0
    ? Math.round((current.completed / current.totalBookings) * 100)
    : 0
  const cancellationRate = current.totalBookings > 0
    ? Math.round((current.cancelled / current.totalBookings) * 100)
    : 0
  const noShowRate = current.totalBookings > 0
    ? Math.round((current.noShow / current.totalBookings) * 100)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">{format(today, 'MMMM yyyy')}</p>
      </div>

      {/* This Month */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">This Month</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Total Bookings" value={current.totalBookings} color="blue" icon="📅" />
          <StatCard label="Completed" value={current.completed} color="green" icon="✅" />
          <StatCard label="Cancelled" value={current.cancelled} color="red" icon="❌" />
          <StatCard label="No Shows" value={current.noShow} color="gray" icon="👻" />
          <StatCard label="New Customers" value={current.newCustomers} color="purple" icon="👤" />
        </div>
      </div>

      {/* Rates */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Performance Rates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-4xl font-bold text-green-600">{completionRate}%</p>
            <p className="text-sm text-gray-500 mt-1">Completion Rate</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-4xl font-bold text-red-500">{cancellationRate}%</p>
            <p className="text-sm text-gray-500 mt-1">Cancellation Rate</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-4xl font-bold text-gray-400">{noShowRate}%</p>
            <p className="text-sm text-gray-500 mt-1">No Show Rate</p>
          </div>
        </div>
      </div>

      {/* Last Month Comparison */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Month Comparison</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
          {[
            { label: 'Bookings', curr: current.totalBookings, prev: previous.totalBookings },
            { label: 'Completed', curr: current.completed, prev: previous.completed },
            { label: 'Cancelled', curr: current.cancelled, prev: previous.cancelled },
            { label: 'New Customers', curr: current.newCustomers, prev: previous.newCustomers },
          ].map(({ label, curr, prev }) => {
            const diff = curr - prev
            const sign = diff > 0 ? '+' : ''
            const color = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'
            return (
              <div key={label}>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
                <p className="font-semibold text-xl text-gray-900">{curr}</p>
                <p className={`text-xs ${color}`}>{sign}{diff} vs last month</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

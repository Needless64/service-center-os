import { sanityClient } from '@/lib/sanity/client'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { format, addDays, startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

const SERVICE_LABELS: Record<string, string> = {
  free_service: 'Free Service',
  paid_service: 'Paid Service',
  general_service: 'General Service',
  repair_diagnosis: 'Repair',
  emergency: 'Emergency 🚨',
  other: 'Other',
}

type Booking = {
  _id: string
  bookingId: string
  scheduledDate: string
  scheduledTime: string
  vehicleNumber: string
  vehicleModel?: string
  serviceType: string
  status: string
  notes?: string
  customer?: { name?: string; phoneNumber?: string }
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; days?: string }>
}) {
  const { status: filterStatus, days: daysParam } = await searchParams
  const daysAhead = Math.min(Number(daysParam ?? 7), 30)

  const today = format(new Date(), 'yyyy-MM-dd')
  const endDate = format(addDays(new Date(), daysAhead), 'yyyy-MM-dd')

  const bookings: Booking[] = await sanityClient.fetch(
    `*[_type == "booking" && scheduledDate >= $today && scheduledDate <= $endDate] | order(scheduledDate asc, scheduledTime asc){
      _id, bookingId, scheduledDate, scheduledTime, vehicleNumber, vehicleModel,
      serviceType, status, notes,
      customer->{ name, phoneNumber }
    }`,
    { today, endDate }
  )

  const filtered = filterStatus
    ? bookings.filter((b) => b.status === filterStatus)
    : bookings

  // Group by date
  const grouped: Record<string, Booking[]> = {}
  for (const b of filtered) {
    if (!grouped[b.scheduledDate]) grouped[b.scheduledDate] = []
    grouped[b.scheduledDate].push(b)
  }

  const dates = Object.keys(grouped).sort()

  const STATUS_FILTERS = [
    { key: '', label: 'All' },
    { key: 'booked', label: 'Booked' },
    { key: 'received', label: 'Received' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  function dateLabel(dateStr: string) {
    if (dateStr === today) return 'Today'
    if (dateStr === format(addDays(new Date(), 1), 'yyyy-MM-dd')) return 'Tomorrow'
    return format(new Date(dateStr), 'EEE, d MMM')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} booking{filtered.length !== 1 ? 's' : ''} · next {daysAhead} days
          </p>
        </div>

        {/* Days selector */}
        <div className="flex items-center gap-1 text-sm">
          {[3, 7, 14].map((d) => (
            <a
              key={d}
              href={`/dashboard/bookings?days=${d}${filterStatus ? `&status=${filterStatus}` : ''}`}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                daysAhead === d ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}d
            </a>
          ))}
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <a
            key={f.key}
            href={`/dashboard/bookings?days=${daysAhead}${f.key ? `&status=${f.key}` : ''}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              (filterStatus ?? '') === f.key
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {/* Grouped booking list */}
      {dates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium text-gray-600">No bookings in next {daysAhead} days</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  date === today
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {dateLabel(date)}
                </span>
                <span className="text-xs text-gray-400">
                  {format(new Date(date + 'T00:00:00'), 'EEEE, d MMMM yyyy')} · {grouped[date].length} booking{grouped[date].length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Bookings for this date */}
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {grouped[date].map((b) => (
                  <div key={b._id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    {/* Time */}
                    <div className="w-16 shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        {format(new Date(`2000-01-01T${b.scheduledTime}`), 'h:mm a')}
                      </p>
                    </div>

                    {/* Vehicle */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 font-mono text-sm">{b.vehicleNumber}</p>
                      <p className="text-xs text-gray-400">{b.vehicleModel ?? '—'}</p>
                    </div>

                    {/* Customer */}
                    <div className="flex-1 min-w-0 hidden sm:block">
                      <p className="text-sm text-gray-700">{b.customer?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{b.customer?.phoneNumber}</p>
                    </div>

                    {/* Service */}
                    <div className="hidden md:block w-32 shrink-0">
                      <p className="text-xs text-gray-500">{SERVICE_LABELS[b.serviceType] ?? b.serviceType}</p>
                    </div>

                    {/* Status */}
                    <div className="shrink-0">
                      <StatusBadge status={b.status} />
                    </div>

                    {/* Booking ID */}
                    <div className="hidden lg:block w-24 shrink-0 text-right">
                      <p className="text-xs font-mono text-gray-300">{b.bookingId}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { sanityClient } from '@/lib/sanity/client'
import { BookingManager } from '@/components/admin/BookingManager'
import { format, addDays } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const { days: daysParam } = await searchParams
  const daysAhead = Math.min(Number(daysParam ?? 14), 60)

  const today = format(new Date(), 'yyyy-MM-dd')
  const endDate = format(addDays(new Date(), daysAhead), 'yyyy-MM-dd')

  const bookings = await sanityClient.fetch(
    `*[_type == "booking" && scheduledDate >= $today && scheduledDate <= $endDate] | order(scheduledDate asc, scheduledTime asc){
      _id, bookingId, scheduledDate, scheduledTime, vehicleNumber, vehicleModel,
      serviceType, status, notes,
      customer->{ _id, name, phoneNumber }
    }`,
    { today, endDate }
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Bookings</h1>
          <p className="text-sm text-gray-500 mt-1">Cancel or update status of any booking.</p>
        </div>
        <div className="flex gap-1 text-sm">
          {[7, 14, 30].map((d) => (
            <a key={d} href={`/admin/bookings?days=${d}`}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${daysAhead === d ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {d}d
            </a>
          ))}
        </div>
      </div>
      <BookingManager bookings={bookings} />
    </div>
  )
}

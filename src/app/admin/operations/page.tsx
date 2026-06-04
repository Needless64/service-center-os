import { sanityClient } from '@/lib/sanity/client'
import { OperationsBoard } from '@/components/admin/OperationsBoard'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

async function ensureSlots() {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/generate-slots`, {
      method: 'POST', cache: 'no-store',
    })
  } catch {}
}

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  await ensureSlots()
  const { date } = await searchParams
  const selectedDate = date ?? format(new Date(), 'yyyy-MM-dd')

  const bookings = await sanityClient.fetch(
    `*[_type == "booking" && scheduledDate == $date] | order(scheduledTime asc) {
      _id, bookingId, scheduledDate, scheduledTime,
      vehicleNumber, vehicleModel, serviceType, status, notes,
      customer->{ name, phoneNumber }
    }`,
    { date: selectedDate }
  )

  // Fetch completed records for sidebar: all completed bookings grouped by date
  const completedRecords = await sanityClient.fetch(
    `*[_type == "booking" && status == "completed"] | order(scheduledDate desc) {
      _id, bookingId, scheduledDate, scheduledTime,
      vehicleNumber, vehicleModel, serviceType, status,
      customer->{ name, phoneNumber }
    }[0..199]`
  )

  return (
    <div className="space-y-4">
      <OperationsBoard
        bookings={bookings}
        completedRecords={completedRecords}
        selectedDate={selectedDate}
      />
    </div>
  )
}

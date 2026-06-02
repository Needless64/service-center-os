import { NextRequest, NextResponse } from 'next/server'
import { getBookingsByDate, getTodayDashboard } from '@/lib/sanity/queries'
import { updateBookingStatus, markDelivered } from '@/lib/sanity/mutations'
import { sendReadyForPickupNotification, sendDeliveryConfirmation } from '@/lib/whatsapp/flows/reminderFlow'
import { format } from 'date-fns'

// GET /api/bookings?date=yyyy-MM-dd
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd')
  const view = searchParams.get('view')

  if (view === 'dashboard') {
    const data = await getTodayDashboard(date)
    return NextResponse.json(data)
  }

  const bookings = await getBookingsByDate(date)
  return NextResponse.json(bookings)
}

// PATCH /api/bookings  — update status
// Body: { bookingDocId, status, customerPhone?, finalCost? }
export async function PATCH(req: NextRequest) {
  try {
    const { bookingDocId, bookingData, status, customerPhone, finalCost } = await req.json()

    if (!bookingDocId || !status) {
      return NextResponse.json({ error: 'Missing bookingDocId or status' }, { status: 400 })
    }

    if (status === 'delivered') {
      await markDelivered(bookingDocId, finalCost)
      if (customerPhone && bookingData) {
        await sendDeliveryConfirmation(bookingData, customerPhone)
      }
    } else {
      await updateBookingStatus(bookingDocId, status)

      if (status === 'ready' && customerPhone && bookingData) {
        await sendReadyForPickupNotification(bookingData, customerPhone)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[bookings PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

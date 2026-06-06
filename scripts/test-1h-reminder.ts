import 'dotenv/config'
import { createClient } from '@sanity/client'
import { nanoid } from 'nanoid'

async function main() {
  const sanity = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
    apiVersion: '2024-01-01',
    useCdn: false,
    token: process.env.SANITY_API_TOKEN!,
  })
  const REAL_CUSTOMER_ID = 'OleMT6lpEjKkF69wuLrfEB'
  // 60 minutes from now in IST
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  ist.setMinutes(ist.getMinutes() + 60)
  const date = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`
  const time = `${String(ist.getHours()).padStart(2, '0')}:${String(ist.getMinutes()).padStart(2, '0')}`
  console.log('Booking for', date, time, 'IST (60 min from now)')

  const slotId = `slot.${date}.${time}`.replace(/[^a-zA-Z0-9._-]/g, '_')
  const existingSlot = await sanity.fetch('*[_id == $id][0]{ _id }', { id: slotId })
  if (!existingSlot) {
    await sanity.create({ _id: slotId, _type: 'slot', date, time, capacity: 100, currentBookings: 0, isBlocked: false })
  }

  const booking = await sanity.create({
    _type: 'booking',
    bookingId: `BK-${nanoid(8).toUpperCase()}`,
    customer: { _type: 'reference', _ref: REAL_CUSTOMER_ID },
    vehicleNumber: `TS09T1${Math.floor(Math.random() * 900) + 100}`,
    vehicleModel: 'TestBike 1h',
    manufacturer: 'Test',
    serviceType: 'paid_service',
    scheduledDate: date,
    scheduledTime: time,
    status: 'booked',
    notes: '1H-TEST',
    reminderSent24h: false,
    reminderSent3h: false,
    reminderSent30m: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  console.log('booking:', booking.bookingId)
  await sanity.patch(slotId).inc({ currentBookings: 1 }).commit()
}
main().catch((e) => { console.error(e); process.exit(1) })

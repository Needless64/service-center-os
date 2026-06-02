'use client'

import { useState } from 'react'
import { BookingCard } from './BookingCard'

type Booking = {
  _id: string
  bookingId: string
  vehicleNumber: string
  vehicleModel?: string
  scheduledTime: string
  serviceType: string
  status: string
  notes?: string
  estimatedCost?: number
  customer?: { name?: string; phoneNumber?: string }
}

const STATUS_ORDER = ['booked', 'received', 'inspection', 'in_service', 'quality_check', 'ready', 'delivered', 'cancelled']

export function TodayBookings({ bookings: initial }: { bookings: Booking[] }) {
  const [bookings, setBookings] = useState(initial)
  const [filter, setFilter] = useState<string>('active')

  async function refresh() {
    const res = await fetch(`/api/bookings?date=${new Date().toISOString().slice(0, 10)}`)
    const data = await res.json()
    setBookings(data)
  }

  const filtered =
    filter === 'active'
      ? bookings.filter((b) => !['completed', 'cancelled', 'no_show'].includes(b.status))
      : filter === 'all'
      ? bookings
      : bookings.filter((b) => b.status === filter)

  const sorted = [...filtered].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

  const FILTERS = [
    { key: 'active', label: 'Active' },
    { key: 'booked', label: 'Booked' },
    { key: 'received', label: 'Received' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Today&apos;s Bookings</h2>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === f.key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">No bookings for this filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map((b) => (
            <BookingCard key={b._id} booking={b} onStatusUpdate={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}

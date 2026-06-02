'use client'

import { useState } from 'react'
import { StatusBadge } from './StatusBadge'
import { format } from 'date-fns'

type Customer = { name?: string; phoneNumber?: string }
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
  customer?: Customer
}

const SERVICE_LABELS: Record<string, string> = {
  free_service: 'Free Service',
  paid_service: 'General Paid Service',
  repair_diagnosis: 'Repair / Diagnosis',
  emergency: 'Emergency',
  other: 'Other',
}

const NEXT_STATUS: Record<string, string> = {
  booked: 'received',
  received: 'completed',
}

const NEXT_LABEL: Record<string, string> = {
  booked: 'Mark Received',
  received: 'Mark Completed',
}

export function BookingCard({ booking, onStatusUpdate }: { booking: Booking; onStatusUpdate: () => void }) {
  const [loading, setLoading] = useState(false)

  const timeFormatted = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')
  const nextStatus = NEXT_STATUS[booking.status]
  const nextLabel = NEXT_LABEL[booking.status]

  async function handleAdvance() {
    if (!nextStatus) return
    setLoading(true)
    try {
      await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingDocId: booking._id,
          status: nextStatus,
          customerPhone: booking.customer?.phoneNumber,
          bookingData: booking,
        }),
      })
      onStatusUpdate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{booking.vehicleNumber}</p>
          <p className="text-sm text-gray-500">{booking.vehicleModel ?? ''}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <p><span className="text-gray-400">Time:</span> {timeFormatted}</p>
        <p><span className="text-gray-400">Service:</span> {SERVICE_LABELS[booking.serviceType] ?? booking.serviceType}</p>
        {booking.customer?.name && (
          <p><span className="text-gray-400">Customer:</span> {booking.customer.name}</p>
        )}
        {booking.estimatedCost && (
          <p><span className="text-gray-400">Est. Cost:</span> ₹{booking.estimatedCost}</p>
        )}
        {booking.notes && (
          <p className="text-xs bg-yellow-50 text-yellow-700 rounded px-2 py-1 mt-1">{booking.notes}</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="text-xs text-gray-400 font-mono">{booking.bookingId}</span>
        {nextLabel && (
          <button
            onClick={handleAdvance}
            disabled={loading}
            className="text-xs font-medium bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Updating...' : nextLabel}
          </button>
        )}
      </div>
    </div>
  )
}

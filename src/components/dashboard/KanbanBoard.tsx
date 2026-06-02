'use client'

import { useState } from 'react'
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
  customer?: Customer
}

const SERVICE_LABELS: Record<string, string> = {
  free_service: 'Free Service',
  paid_service: 'Paid Service',
  general_service: 'General Service',
  repair_diagnosis: 'Repair',
  emergency: 'Emergency 🚨',
  emergency_breakdown: 'Emergency 🚨',
  warranty_service: 'Warranty',
  other: 'Other',
}

const COLUMNS: { key: string; label: string; color: string; bg: string; action: string; nextStatus: string }[] = [
  { key: 'booked',    label: 'Booked',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    action: 'Vehicle Arrived',  nextStatus: 'received' },
  { key: 'received',  label: 'In Workshop', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', action: 'Mark Complete', nextStatus: 'completed' },
  { key: 'completed', label: 'Completed', color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  action: '',              nextStatus: '' },
]

function VehicleCard({
  booking,
  action,
  nextStatus,
  onUpdate,
}: {
  booking: Booking
  action: string
  nextStatus: string
  onUpdate: () => void
}) {
  const [loading, setLoading] = useState(false)
  const time = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')
  const isEmergency = booking.serviceType === 'emergency'

  async function handleMove() {
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
      onUpdate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`rounded-xl border p-4 bg-white shadow-sm space-y-3 ${isEmergency ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900 text-base tracking-wide">{booking.vehicleNumber}</p>
          <p className="text-xs text-gray-500">{booking.vehicleModel || '—'}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${isEmergency ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
          {SERVICE_LABELS[booking.serviceType] ?? booking.serviceType}
        </span>
      </div>

      {/* Customer + time */}
      <div className="text-sm text-gray-600 space-y-0.5">
        <p>👤 {booking.customer?.name ?? 'Unknown'}</p>
        <p>⏰ Slot: {time}</p>
      </div>

      {booking.notes && (
        <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2 py-1.5">
          📝 {booking.notes}
        </p>
      )}

      {/* Action */}
      {action && (
        <button
          onClick={handleMove}
          disabled={loading}
          className="w-full py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Updating…' : action + ' →'}
        </button>
      )}

      <p className="text-xs text-gray-300 font-mono">{booking.bookingId}</p>
    </div>
  )
}

export function KanbanBoard({ bookings: initial }: { bookings: Booking[] }) {
  const [bookings, setBookings] = useState(initial)

  async function refresh() {
    const today = new Date().toISOString().slice(0, 10)
    const res = await fetch(`/api/bookings?date=${today}`)
    const data = await res.json()
    setBookings(data)
  }

  const cancelled = bookings.filter((b) => ['cancelled', 'no_show'].includes(b.status))

  return (
    <div className="space-y-2">
      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const colBookings = bookings
            .filter((b) => b.status === col.key)
            .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

          return (
            <div key={col.key} className="flex flex-col gap-3">
              {/* Column header */}
              <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${col.bg}`}>
                <span className={`font-bold text-sm ${col.color}`}>{col.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white ${col.color}`}>
                  {colBookings.length}
                </span>
              </div>

              {/* Cards */}
              {colBookings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-300">
                  Nothing here
                </div>
              ) : (
                colBookings.map((b) => (
                  <VehicleCard
                    key={b._id}
                    booking={b}
                    action={col.action}
                    nextStatus={col.nextStatus}
                    onUpdate={refresh}
                  />
                ))
              )}
            </div>
          )
        })}
      </div>

      {/* Cancelled / No show row */}
      {cancelled.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-gray-400 cursor-pointer select-none">
            {cancelled.length} cancelled / no-show
          </summary>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cancelled.map((b) => (
              <div key={b._id} className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-xs text-gray-400">
                <p className="font-mono font-semibold">{b.vehicleNumber}</p>
                <p>{b.customer?.name}</p>
                <p className="capitalize">{b.status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

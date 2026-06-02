'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { clsx } from 'clsx'

type Customer = { _id?: string; name?: string; phoneNumber?: string }
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
  customer?: Customer
}

const SERVICE_LABELS: Record<string, string> = {
  free_service: 'Free Service', paid_service: 'Paid Service',
  general_service: 'General Service', repair_diagnosis: 'Repair',
  emergency: 'Emergency 🚨', other: 'Other',
}

const STATUS_OPTIONS = [
  { value: 'booked',    label: 'Booked',     color: 'bg-blue-100 text-blue-700' },
  { value: 'received',  label: 'Received',   color: 'bg-indigo-100 text-indigo-700' },
  { value: 'completed', label: 'Completed',  color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelled',  color: 'bg-red-100 text-red-600' },
  { value: 'no_show',   label: 'No Show',    color: 'bg-gray-100 text-gray-500' },
]

function StatusPill({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status)
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', opt?.color ?? 'bg-gray-100 text-gray-500')}>
      {opt?.label ?? status}
    </span>
  )
}

function BookingRow({ booking, onUpdate }: { booking: Booking; onUpdate: (id: string, status: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(booking.status)
  const [saved, setSaved] = useState(false)

  const dateStr = format(new Date(booking.scheduledDate + 'T00:00:00'), 'd MMM')
  const timeStr = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')
  const today = format(new Date(), 'yyyy-MM-dd')
  const isToday = booking.scheduledDate === today

  async function handleSave() {
    if (selected === booking.status) return
    setLoading(true)
    try {
      await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingDocId: booking._id, status: selected, customerPhone: booking.customer?.phoneNumber }),
      })
      onUpdate(booking._id, selected)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={clsx('px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3', isToday && 'bg-green-50/50')}>
      {/* Date/time */}
      <div className="w-20 shrink-0">
        <p className={clsx('text-xs font-bold', isToday ? 'text-green-700' : 'text-gray-400')}>{isToday ? 'TODAY' : dateStr}</p>
        <p className="text-sm font-semibold text-gray-900">{timeStr}</p>
      </div>

      {/* Vehicle + customer */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 font-mono text-sm">{booking.vehicleNumber}
          <span className="font-normal text-gray-400 font-sans ml-1.5 text-xs">{booking.vehicleModel}</span>
        </p>
        <p className="text-xs text-gray-500">{booking.customer?.name ?? '—'} · {SERVICE_LABELS[booking.serviceType] ?? booking.serviceType}</p>
        {booking.notes && <p className="text-xs text-amber-600 mt-0.5">📝 {booking.notes}</p>}
      </div>

      {/* Booking ID */}
      <p className="text-xs font-mono text-gray-300 hidden md:block w-24 shrink-0">{booking.bookingId}</p>

      {/* Status selector + save */}
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-gray-900 outline-none bg-white"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {selected !== booking.status && (
          <button
            onClick={handleSave}
            disabled={loading}
            className="text-xs font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? '…' : 'Save'}
          </button>
        )}
        {saved && <span className="text-xs text-green-600 font-medium">✓</span>}
        {selected === booking.status && <StatusPill status={booking.status} />}
      </div>
    </div>
  )
}

export function BookingManager({ bookings: initial }: { bookings: Booking[] }) {
  const [bookings, setBookings] = useState(initial)
  const [search, setSearch] = useState('')

  function handleUpdate(id: string, newStatus: string) {
    setBookings((prev) => prev.map((b) => b._id === id ? { ...b, status: newStatus } : b))
  }

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase()
    return !q || b.vehicleNumber.toLowerCase().includes(q) ||
      b.bookingId.toLowerCase().includes(q) ||
      b.customer?.name?.toLowerCase().includes(q) ||
      b.customer?.phoneNumber?.includes(q)
  })

  // Group by date
  const grouped: Record<string, Booking[]> = {}
  for (const b of filtered) {
    if (!grouped[b.scheduledDate]) grouped[b.scheduledDate] = []
    grouped[b.scheduledDate].push(b)
  }

  return (
    <div className="space-y-4">
      <input
        placeholder="🔍  Search by vehicle, booking ID, customer…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 outline-none bg-white"
      />

      {Object.keys(grouped).sort().map((date) => {
        const label = date === format(new Date(), 'yyyy-MM-dd') ? 'Today'
          : date === format(new Date(Date.now() + 86400000), 'yyyy-MM-dd') ? 'Tomorrow'
          : format(new Date(date + 'T00:00:00'), 'EEE, d MMM')
        return (
          <div key={date}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 px-1">{label}</p>
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {grouped[date].map((b) => (
                <BookingRow key={b._id} booking={b} onUpdate={handleUpdate} />
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
          No bookings found
        </div>
      )}
    </div>
  )
}

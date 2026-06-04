'use client'

import { useState, useRef } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

type Customer = { name?: string; phoneNumber?: string }
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

// ─── Config ───────────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, { label: string; color: string }> = {
  free_service:     { label: 'Free',     color: 'bg-green-100 text-green-700' },
  paid_service:     { label: 'Paid',     color: 'bg-blue-100 text-blue-700'   },
  repair_diagnosis: { label: 'Repair',   color: 'bg-orange-100 text-orange-700'},
  emergency:        { label: '🚨 Emergency', color: 'bg-red-100 text-red-700' },
  other:            { label: 'Other',    color: 'bg-gray-100 text-gray-600'   },
}

const LANES = [
  { key: 'booked',    label: 'Booked',    icon: '📅', header: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-500'   },
  { key: 'received',  label: 'Received',  icon: '🔑', header: 'bg-indigo-50 border-indigo-200',dot: 'bg-indigo-500' },
  { key: 'completed', label: 'Completed', icon: '✅', header: 'bg-green-50 border-green-200',  dot: 'bg-green-500'  },
  { key: 'no_show',   label: 'No Show',   icon: '👻', header: 'bg-gray-50 border-gray-200',    dot: 'bg-gray-400'   },
  { key: 'cancelled', label: 'Cancelled', icon: '❌', header: 'bg-red-50 border-red-200',      dot: 'bg-red-400'    },
]

// ─── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  onDragStart,
  isDragging,
}: {
  booking: Booking
  onDragStart: (id: string) => void
  isDragging: boolean
}) {
  const time = format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')
  const svc = SERVICE_LABELS[booking.serviceType] ?? { label: booking.serviceType, color: 'bg-gray-100 text-gray-600' }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(booking._id)}
      className={clsx(
        'bg-white rounded-xl border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing select-none transition-all',
        isDragging ? 'opacity-40 scale-95' : 'hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      {/* Vehicle + time */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p className="font-bold text-gray-900 font-mono text-sm leading-tight">{booking.vehicleNumber}</p>
        <p className="text-xs text-gray-400 shrink-0">{time}</p>
      </div>

      {/* Model */}
      {booking.vehicleModel && (
        <p className="text-xs text-gray-400 mb-1.5">{booking.vehicleModel}</p>
      )}

      {/* Customer */}
      {booking.customer?.name && (
        <p className="text-xs text-gray-600 mb-1.5">👤 {booking.customer.name}</p>
      )}

      {/* Service type badge */}
      <span className={clsx('inline-block text-xs font-medium px-1.5 py-0.5 rounded-md', svc.color)}>
        {svc.label}
      </span>

      {/* Notes */}
      {booking.notes && (
        <p className="text-xs text-amber-600 mt-1.5 truncate">📝 {booking.notes}</p>
      )}

      {/* Booking ID */}
      <p className="text-xs text-gray-200 font-mono mt-1.5">{booking.bookingId}</p>
    </div>
  )
}

// ─── Drop lane ────────────────────────────────────────────────────────────────

function Lane({
  lane,
  bookings,
  draggingId,
  isOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
}: {
  lane: typeof LANES[0]
  bookings: Booking[]
  draggingId: string | null
  isOver: boolean
  onDragStart: (id: string) => void
  onDragOver: (e: React.DragEvent, key: string) => void
  onDrop: (key: string) => void
  onDragLeave: () => void
}) {
  return (
    <div className="flex flex-col min-w-0 flex-1">
      {/* Lane header */}
      <div className={clsx('rounded-t-xl border-2 px-3 py-2 flex items-center gap-2', lane.header)}>
        <span className="text-sm">{lane.icon}</span>
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{lane.label}</span>
        <span className={clsx('ml-auto text-xs font-bold text-white w-5 h-5 rounded-full flex items-center justify-center', lane.dot)}>
          {bookings.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => onDragOver(e, lane.key)}
        onDrop={() => onDrop(lane.key)}
        onDragLeave={onDragLeave}
        className={clsx(
          'flex-1 min-h-[200px] rounded-b-xl border-2 border-t-0 p-2 space-y-2 transition-all',
          lane.header.replace('bg-', 'bg-').replace('border-', 'border-'),
          isOver ? 'border-dashed ring-2 ring-inset ring-gray-900 bg-gray-50' : ''
        )}
      >
        {bookings.map((b) => (
          <BookingCard
            key={b._id}
            booking={b}
            onDragStart={onDragStart}
            isDragging={draggingId === b._id}
          />
        ))}
        {bookings.length === 0 && (
          <div className={clsx(
            'h-16 flex items-center justify-center rounded-lg border-2 border-dashed text-xs text-gray-300 transition-colors',
            isOver ? 'border-gray-400 text-gray-400 bg-white' : 'border-gray-200'
          )}>
            {isOver ? 'Drop here' : 'Empty'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Completed sidebar ────────────────────────────────────────────────────────

function CompletedSidebar({ records, open, onClose }: {
  records: Booking[]
  open: boolean
  onClose: () => void
}) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  const grouped: Record<string, Booking[]> = {}
  for (const r of records) {
    if (!grouped[r.scheduledDate]) grouped[r.scheduledDate] = []
    grouped[r.scheduledDate].push(r)
  }
  const dates = Object.keys(grouped).sort().reverse()

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/20 z-20" onClick={onClose} />}
      <div className={clsx(
        'fixed right-0 top-0 h-full w-72 bg-white shadow-2xl z-30 flex flex-col transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        <div className="px-4 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Completed Records</h2>
            <p className="text-xs text-gray-400">{records.length} total</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {dates.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No records yet</div>}
          {dates.map((date) => {
            const today = format(new Date(), 'yyyy-MM-dd')
            const label = date === today ? 'Today'
              : date === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? 'Yesterday'
              : format(new Date(date + 'T00:00:00'), 'EEE, d MMM yyyy')
            const expanded = expandedDate === date
            return (
              <div key={date}>
                <button
                  onClick={() => setExpandedDate(expanded ? null : date)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{label}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{grouped[date].length}</span>
                  </div>
                  <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
                </button>
                {expanded && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {grouped[date].map((r) => (
                      <div key={r._id} className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex justify-between">
                          <p className="text-xs font-bold font-mono text-gray-900">{r.vehicleNumber}</p>
                          <p className="text-xs text-gray-400">{format(new Date(`2000-01-01T${r.scheduledTime}`), 'h:mm a')}</p>
                        </div>
                        <p className="text-xs text-gray-500">{r.customer?.name ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export function OperationsBoard({ bookings: initial, completedRecords, selectedDate }: {
  bookings: Booking[]
  completedRecords: Booking[]
  selectedDate: string
}) {
  const [bookings, setBookings] = useState(initial)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [date, setDate] = useState(selectedDate)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overLane, setOverLane] = useState<string | null>(null)

  const today = format(new Date(), 'yyyy-MM-dd')
  const dateLabel = date === today ? 'Today'
    : date === format(addDays(new Date(), 1), 'yyyy-MM-dd') ? 'Tomorrow'
    : date === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? 'Yesterday'
    : format(new Date(date + 'T00:00:00'), 'EEEE, d MMMM yyyy')

  async function changeDate(newDate: string) {
    setDate(newDate)
    const res = await fetch(`/api/bookings?date=${newDate}`)
    setBookings(await res.json())
  }

  function handleDragStart(id: string) {
    setDraggingId(id)
  }

  function handleDragOver(e: React.DragEvent, laneKey: string) {
    e.preventDefault()
    setOverLane(laneKey)
  }

  function handleDragLeave() {
    setOverLane(null)
  }

  async function handleDrop(targetStatus: string) {
    if (!draggingId) return
    const booking = bookings.find((b) => b._id === draggingId)
    if (!booking || booking.status === targetStatus) {
      setDraggingId(null)
      setOverLane(null)
      return
    }

    // Optimistic update
    setBookings((prev) => prev.map((b) => b._id === draggingId ? { ...b, status: targetStatus } : b))
    setDraggingId(null)
    setOverLane(null)

    // Persist
    await fetch('/api/admin/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingDocId: draggingId,
        status: targetStatus,
        customerPhone: booking.customer?.phoneNumber,
        bookingData: booking,
      }),
    })
  }

  const totalCompleted = completedRecords.length + bookings.filter((b) => b.status === 'completed').length
  const active = bookings.filter((b) => !['completed','cancelled','no_show'].includes(b.status)).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dateLabel} · {active} active · {bookings.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(format(subDays(new Date(date + 'T00:00:00'), 1), 'yyyy-MM-dd'))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500">‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && changeDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
          <button onClick={() => changeDate(format(addDays(new Date(date + 'T00:00:00'), 1), 'yyyy-MM-dd'))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500">›</button>
          <button onClick={() => changeDate(today)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500">Today</button>
          <button onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            <span>✅</span>
            <span className="bg-green-500 text-xs px-1.5 py-0.5 rounded-full">{totalCompleted}</span>
          </button>
        </div>
      </div>

      {/* Horizontal rails */}
      {bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-gray-500 text-sm">No bookings for {dateLabel.toLowerCase()}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {LANES.map((lane) => {
            const laneBookings = bookings.filter((b) => b.status === lane.key)
            const isOver = overLane === lane.key
            return (
              <div
                key={lane.key}
                onDragOver={(e) => handleDragOver(e, lane.key)}
                onDrop={() => handleDrop(lane.key)}
                onDragLeave={handleDragLeave}
                className={clsx(
                  'flex items-stretch rounded-xl border-2 transition-all min-h-[80px]',
                  lane.header,
                  isOver && 'ring-2 ring-inset ring-gray-900'
                )}
              >
                {/* Lane label — fixed left column */}
                <div className="w-28 shrink-0 flex flex-col items-center justify-center gap-1 px-2 py-3 border-r-2 border-inherit">
                  <span className="text-lg">{lane.icon}</span>
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wide text-center leading-tight">{lane.label}</span>
                  <span className={clsx('text-xs font-bold text-white w-5 h-5 rounded-full flex items-center justify-center', lane.dot)}>
                    {laneBookings.length}
                  </span>
                </div>

                {/* Scrollable cards area */}
                <div className="flex-1 flex items-center gap-2 overflow-x-auto px-3 py-2 min-w-0">
                  {laneBookings.map((b) => (
                    <div key={b._id} className="shrink-0 w-44">
                      <BookingCard booking={b} onDragStart={handleDragStart} isDragging={draggingId === b._id} />
                    </div>
                  ))}
                  {laneBookings.length === 0 && (
                    <div className={clsx(
                      'w-32 h-14 flex items-center justify-center rounded-lg border-2 border-dashed text-xs transition-colors',
                      isOver ? 'border-gray-400 text-gray-400 bg-white' : 'border-gray-200 text-gray-300'
                    )}>
                      {isOver ? 'Drop here' : 'Empty'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CompletedSidebar records={completedRecords} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  )
}

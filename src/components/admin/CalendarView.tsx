'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay, addMonths, subMonths } from 'date-fns'
import { clsx } from 'clsx'
import { adminFetch } from '@/lib/adminFetch'

// ─── Types ────────────────────────────────────────────────────────────────────

type DaySummary = { totalCapacity: number; booked: number; bookingCount: number }
type Booking = {
  _id: string; bookingId: string; scheduledDate: string; scheduledTime: string
  vehicleNumber: string; serviceType: string; status: string
  customer?: { name?: string; phoneNumber?: string }
}
type SlotDoc = { _id: string; date: string; time: string; capacity: number; currentBookings: number }

const SERVICE_LABELS: Record<string, string> = {
  free_service: 'Free', paid_service: 'Paid', general_service: 'General',
  repair_diagnosis: 'Repair', emergency: '🚨 Emergency', other: 'Other',
}
const STATUS_OPTIONS = ['booked', 'received', 'completed', 'cancelled', 'no_show']
const STATUS_COLOR: Record<string, string> = {
  booked: 'text-blue-600', received: 'text-indigo-600', completed: 'text-green-600',
  cancelled: 'text-red-400', no_show: 'text-gray-400',
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Dot color: absolute thresholds (independent of total capacity) ───────────

function dotColor(summary: DaySummary): string {
  if (!summary || summary.totalCapacity === 0) return 'bg-gray-200'
  const left = summary.totalCapacity - summary.booked
  if (left === 0) return 'bg-red-500'
  if (left <= 3) return 'bg-yellow-400'
  return 'bg-green-400'
}

// ─── Calendar Cell ────────────────────────────────────────────────────────────

function DayCell({ date, summary, selected, onSelect }: {
  date: Date; summary?: DaySummary; selected: boolean; onSelect: () => void
}) {
  const today = isToday(date)
  const past = date < new Date(new Date().setHours(0, 0, 0, 0))
  const left = summary ? summary.totalCapacity - summary.booked : null

  return (
    <button
      onClick={onSelect}
      disabled={past && !summary?.bookingCount}
      className={clsx(
        'h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-sm font-medium border',
        selected ? 'bg-gray-900 text-white border-gray-900'
          : today ? 'bg-green-50 border-green-300 text-green-700'
          : past ? 'border-transparent text-gray-200 cursor-default'
          : 'border-transparent hover:border-gray-200 hover:bg-gray-50 text-gray-700'
      )}
    >
      <span>{format(date, 'd')}</span>
      {summary && summary.totalCapacity > 0 && (
        <div className="flex items-center gap-1">
          <span className={clsx('w-1.5 h-1.5 rounded-full', dotColor(summary))} />
          <span className={clsx('text-xs', selected ? 'text-white/70' : 'text-gray-400')}>
            {left} left
          </span>
        </div>
      )}
      {summary && summary.totalCapacity === 0 && summary.bookingCount > 0 && (
        <span className={clsx('text-xs', selected ? 'text-white/70' : 'text-gray-400')}>
          {summary.bookingCount} bk
        </span>
      )}
    </button>
  )
}

// ─── Booking row with inline status change ────────────────────────────────────

function BookingRow({ booking, onChange }: { booking: Booking; onChange: (id: string, s: string) => void }) {
  const [status, setStatus] = useState(booking.status)
  const [saving, setSaving] = useState(false)

  async function handleChange(newStatus: string) {
    setSaving(true)
    setStatus(newStatus)
    await adminFetch('/api/admin/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingDocId: booking._id, status: newStatus }),
    })
    onChange(booking._id, newStatus)
    setSaving(false)
  }

  return (
    <div className="px-4 py-3 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-900 font-mono">{booking.vehicleNumber}</p>
        <p className="text-xs text-gray-400">
          {format(new Date(`2000-01-01T${booking.scheduledTime}`), 'h:mm a')} · {SERVICE_LABELS[booking.serviceType] ?? booking.serviceType}
        </p>
        {booking.customer?.name && <p className="text-xs text-gray-500 mt-0.5">{booking.customer.name}</p>}
      </div>
      <select
        value={status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className={clsx(
          'text-xs border border-gray-200 rounded-lg px-1.5 py-1 outline-none focus:ring-1 focus:ring-gray-900 bg-white shrink-0 disabled:opacity-50',
          STATUS_COLOR[status]
        )}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Day-level bulk capacity + duration override ──────────────────────────────

type BranchInfo = { workingHours: { start: string; end: string }; slotDurationMinutes: number; capacityPerSlot: number }

function DayCapacityOverride({ date, slots, onApplied }: {
  date: string
  slots: SlotDoc[]
  onApplied: (cap: number) => void
}) {
  const [branch, setBranch] = useState<BranchInfo | null>(null)
  const [capacity, setCapacity] = useState(String(slots[0]?.capacity ?? 10))
  const [duration, setDuration] = useState('60')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load branch defaults once
  useEffect(() => {
    adminFetch('/api/admin/branch').then((r) => r.json()).then((b: BranchInfo) => {
      setBranch(b)
      setDuration(String(b.slotDurationMinutes ?? 60))
      setStartTime(b.workingHours?.start ?? '09:00')
      setEndTime(b.workingHours?.end ?? '18:00')
    })
  }, [])

  // Reset capacity when date/slots change
  useEffect(() => {
    setCapacity(String(slots[0]?.capacity ?? branch?.capacityPerSlot ?? 10))
  }, [date, slots, branch])

  async function handleApply() {
    const cap = parseInt(capacity)
    const dur = parseInt(duration)
    if (isNaN(cap) || cap < 1 || isNaN(dur) || dur < 15) return
    setSaving(true)
    await adminFetch('/api/admin/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, capacity: cap, slotDurationMinutes: dur, startTime, endTime }),
    })
    await onApplied(cap)   // await so caller can refresh before we clear saving state
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const minCap = Math.max(...(slots.length ? slots.map((s) => s.currentBookings) : [0]), 1)

  return (
    <div className="px-4 py-4 border-b border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Set All Slots This Day
      </p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Opens at</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Closes at</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Vehicles per slot</label>
          <input type="number" min={minCap} value={capacity} onChange={(e) => setCapacity(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Slot duration</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-gray-900 outline-none">
            <option value="30">30 min</option>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
            <option value="120">2 hours</option>
          </select>
        </div>
      </div>
      {minCap > 1 && <p className="text-xs text-amber-600 mb-2">Min capacity: {minCap} (existing bookings)</p>}
      <button onClick={handleApply} disabled={saving}
        className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
        {saving ? 'Applying…' : saved ? '✓ Applied' : 'Apply to All Slots'}
      </button>
    </div>
  )
}

// ─── Slot capacity row with ± controls ───────────────────────────────────────

function SlotCapacityRow({ slot, onUpdate }: { slot: SlotDoc; onUpdate: (cap: number) => void }) {
  const [cap, setCap] = useState(slot.capacity)
  const [saving, setSaving] = useState(false)
  const left = cap - slot.currentBookings
  const isFull = left <= 0

  async function update(newCap: number) {
    if (newCap < slot.currentBookings || newCap < 1) return
    setSaving(true)
    setCap(newCap)
    await adminFetch('/api/admin/slots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: slot._id, capacity: newCap }),
    })
    onUpdate(newCap)
    setSaving(false)
  }

  return (
    <div className={clsx(
      'flex items-center justify-between rounded-lg px-3 py-2 text-xs gap-2',
      isFull ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-100'
    )}>
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-semibold text-gray-900 shrink-0">
          {format(new Date(`2000-01-01T${slot.time}`), 'h:mm a')}
        </span>
        <span className="text-gray-400 shrink-0">{slot.currentBookings}/</span>
        <span className={clsx('font-bold', isFull ? 'text-red-600' : 'text-gray-700')}>{cap}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={clsx('text-xs font-medium mr-1', isFull ? 'text-red-500' : 'text-green-600')}>
          {isFull ? 'FULL' : `${left} free`}
        </span>
        <button
          onClick={() => update(cap - 1)}
          disabled={saving || cap <= slot.currentBookings}
          className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold"
        >−</button>
        <button
          onClick={() => update(cap + 1)}
          disabled={saving}
          className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center font-bold"
        >+</button>
      </div>
    </div>
  )
}

// ─── Hour-bucket capacity row ───────────────────────────────────────────────

function HourBucketRow({
  hour,
  slotsInHour,
  onUpdate,
}: {
  hour: string                       // "09", "10", ...
  slotsInHour: SlotDoc[]
  onUpdate: (newCap: number) => void
}) {
  const [cap, setCap] = useState(slotsInHour[0]?.capacity ?? 1)
  const [saving, setSaving] = useState(false)

  // Re-sync if the slots change (e.g. onUpdate from parent re-fetches)
  useEffect(() => {
    setCap(slotsInHour[0]?.capacity ?? 1)
  }, [slotsInHour])

  const totalBooked = slotsInHour.reduce((s, x) => s + (x.currentBookings ?? 0), 0)
  const totalCapacity = cap * Math.max(slotsInHour.length, 1)
  const totalFree = totalCapacity - totalBooked
  const isFull = totalFree <= 0
  const minCapForHour = Math.max(...(slotsInHour.length ? slotsInHour.map((s) => s.currentBookings) : [0]), 1)

  async function update(newCap: number) {
    if (newCap < minCapForHour || newCap < 1) return
    setSaving(true)
    setCap(newCap)
    // Update every slot in the hour concurrently. We don't roll back
    // partial failures (rare; admin can retry).
    await Promise.all(
      slotsInHour.map((slot) =>
        adminFetch('/api/admin/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slotId: slot._id, capacity: newCap }),
        })
      )
    )
    onUpdate(newCap)
    setSaving(false)
  }

  return (
    <div className={clsx(
      'flex items-center justify-between rounded-lg px-3 py-2 text-xs gap-2',
      isFull ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-100'
    )}>
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-semibold text-gray-900 shrink-0">
          {format(new Date(`2000-01-01T${hour}:00`), 'h a')}
        </span>
        <span className="text-gray-400 shrink-0">{totalBooked}/</span>
        <span className={clsx('font-bold', isFull ? 'text-red-600' : 'text-gray-700')}>{totalCapacity}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={clsx('text-xs font-medium mr-1', isFull ? 'text-red-500' : 'text-green-600')}>
          {isFull ? 'FULL' : `${totalFree} free`}
        </span>
        <button
          onClick={() => update(cap - 1)}
          disabled={saving || cap <= minCapForHour}
          className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold"
        >−</button>
        <button
          onClick={() => update(cap + 1)}
          disabled={saving}
          className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold"
        >+</button>
      </div>
    </div>
  )
}

function HourBucketCapacity({
  date,
  slots,
  onUpdate,
}: {
  date: string
  slots: SlotDoc[]
  onUpdate: () => void | Promise<void>
}) {
  // Group slots by hour
  const byHour = new Map<string, SlotDoc[]>()
  for (const s of slots) {
    const hour = s.time.slice(0, 2) // "09" from "09:06"
    const arr = byHour.get(hour)
    if (arr) arr.push(s)
    else byHour.set(hour, [s])
  }
  const rows = Array.from(byHour.entries()).sort(([a], [b]) => a.localeCompare(b))

  if (slots.length === 0) {
    return (
      <div className="px-4 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hour Buckets</p>
        <p className="text-xs text-gray-400">No slots for this date</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hour Buckets</p>
      <div className="space-y-1.5">
        {rows.map(([hour, slotsInHour]) => (
          <HourBucketRow
            key={hour}
            hour={hour}
            slotsInHour={slotsInHour}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main CalendarView ────────────────────────────────────────────────────────

export function CalendarView() {
  const [month, setMonth] = useState(new Date())
  const [byDate, setByDate] = useState<Record<string, DaySummary>>({})
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [daySlots, setDaySlots] = useState<SlotDoc[]>([])
  const [dayBookings, setDayBookings] = useState<Booking[]>([])
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [loadingDay, setLoadingDay] = useState(false)
  const [search, setSearch] = useState('')

  const loadMonth = useCallback(async (m: Date) => {
    setLoadingMonth(true)
    try {
      const res = await fetch(`/api/calendar?month=${format(m, 'yyyy-MM')}`)
      const data = await res.json()
      setByDate(data.byDate ?? {})
      setAllBookings(data.bookings ?? [])
    } finally {
      setLoadingMonth(false)
    }
  }, [])

  useEffect(() => { loadMonth(month) }, [month, loadMonth])

  async function handleSelectDate(dateStr: string) {
    setSelectedDate(dateStr)
    setLoadingDay(true)
    try {
      const [slotsRes] = await Promise.all([
        fetch(`/api/admin/slots?date=${dateStr}`),
      ])
      setDaySlots(await slotsRes.json())
      setDayBookings(allBookings.filter((b) => b.scheduledDate === dateStr)
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)))
    } finally {
      setLoadingDay(false)
    }
  }

  function handleBookingStatusChange(id: string, newStatus: string) {
    setDayBookings((prev) => prev.map((b) => b._id === id ? { ...b, status: newStatus } : b))
    setAllBookings((prev) => prev.map((b) => b._id === id ? { ...b, status: newStatus } : b))
  }

  // Build calendar grid
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })
  const startOffset = (getDay(start) + 6) % 7

  // Search across ALL bookings in the month
  const searchResults = search.length >= 2
    ? allBookings.filter((b) => {
        const q = search.toLowerCase()
        return b.vehicleNumber.toLowerCase().includes(q) ||
          b.bookingId.toLowerCase().includes(q) ||
          b.customer?.name?.toLowerCase().includes(q) ||
          b.customer?.phoneNumber?.includes(q)
      }).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.scheduledTime.localeCompare(b.scheduledTime))
    : []

  return (
    <div className="flex gap-6 items-start">
      {/* ── Calendar ── */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-5 min-w-0">
        {/* Search bar */}
        <input
          placeholder="🔍  Search vehicle, booking ID, customer across this month…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-gray-900 outline-none"
        />

        {search.length >= 2 ? (
          /* Search results mode */
          <div>
            <p className="text-xs text-gray-400 mb-2">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {searchResults.map((b) => (
                <div key={b._id} className="py-2">
                  <p className="text-xs text-gray-400 px-1 mb-1">
                    {format(new Date(b.scheduledDate + 'T00:00:00'), 'd MMM')} · {format(new Date(`2000-01-01T${b.scheduledTime}`), 'h:mm a')}
                  </p>
                  <BookingRow booking={b} onChange={handleBookingStatusChange} />
                </div>
              ))}
              {searchResults.length === 0 && <p className="text-sm text-gray-400 p-4">No results</p>}
            </div>
          </div>
        ) : (
          /* Calendar grid mode */
          <>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setMonth((m) => subMonths(m, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">‹</button>
              <h2 className="font-semibold text-gray-900">{format(month, 'MMMM yyyy')}</h2>
              <button onClick={() => setMonth((m) => addMonths(m, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">›</button>
            </div>
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {loadingMonth ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
                {days.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  return (
                    <DayCell key={dateStr} date={day} summary={byDate[dateStr]}
                      selected={selectedDate === dateStr} onSelect={() => handleSelectDate(dateStr)} />
                  )
                })}
              </div>
            )}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
              {[['bg-green-400', 'Available'], ['bg-yellow-400', '≤ 3 left'], ['bg-red-500', 'Full']].map(([color, label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={clsx('w-2 h-2 rounded-full', color)} />
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Day Sidebar ── */}
      <div className={clsx('w-80 shrink-0 bg-white rounded-2xl border border-gray-200 transition-opacity',
        selectedDate ? 'opacity-100' : 'opacity-40')}>
        {!selectedDate ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <p className="text-3xl mb-2">👆</p>
            Click a date to view bookings and manage slots
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">
                  {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, d MMM')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {dayBookings.length} booking{dayBookings.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="text-gray-300 hover:text-gray-500 text-xl leading-none">×</button>
            </div>

            {/* Bookings with status change */}
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {loadingDay ? (
                <p className="px-5 py-4 text-sm text-gray-400">Loading…</p>
              ) : dayBookings.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">No bookings this day</p>
              ) : (
                dayBookings.map((b) => (
                  <BookingRow key={b._id} booking={b} onChange={handleBookingStatusChange} />
                ))
              )}
            </div>

            {/* Day-level capacity override */}
            <DayCapacityOverride
              date={selectedDate}
              slots={daySlots}
              onApplied={async (newCap) => {
                // Refresh slots from server so individual rows update immediately
                const res = await fetch(`/api/admin/slots?date=${selectedDate}`)
                setDaySlots(await res.json())
                loadMonth(month)
              }}
            />

            {/* Hour buckets — aggregate individual 6-min slots into one row per hour */}
            <HourBucketCapacity
              date={selectedDate}
              slots={daySlots}
              onUpdate={async () => {
                const res = await fetch(`/api/admin/slots?date=${selectedDate}`)
                setDaySlots(await res.json())
                loadMonth(month)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

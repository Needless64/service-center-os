'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { clsx } from 'clsx'

const SERVICE_LABELS: Record<string, string> = {
  free_service: 'Free Service', paid_service: 'Paid Service',
  repair_diagnosis: 'Repair', emergency: 'Emergency', other: 'Other',
}

type AnalyticsData = {
  total: number; completed: number; cancelled: number; noShow: number
  received: number; booked: number
  completionRate: number; cancellationRate: number; noShowRate: number
  topService: { type: string; count: number } | null
  peakHour: string | null
  busiestDay: { date: string; count: number } | null
  newCustomers: number
  serviceBreakdown: Record<string, number>
  byDay: Record<string, number>
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={clsx('rounded-xl border p-4', color ?? 'border-gray-200 bg-white')}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="font-bold text-gray-900">{value}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

export function AnalyticsPanel() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics?from=${f}&to=${t}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(from, to) }, [from, to, load])

  const QUICK = [
    { label: 'Today',     from: today, to: today },
    { label: 'This week', from: format(new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 1)), 'yyyy-MM-dd'), to: today },
    { label: 'This month',from: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'), to: today },
    { label: '30 days',   from: format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd'), to: today },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
      {/* Header + date range */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-bold text-gray-900 text-base">Analytics</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK.map((q) => (
            <button
              key={q.label}
              onClick={() => { setFrom(q.from); setTo(q.to) }}
              className={clsx(
                'text-xs px-3 py-1.5 rounded-lg font-medium transition-all border',
                from === q.from && to === q.to
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              )}
            >
              {q.label}
            </button>
          ))}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-gray-900 outline-none" />
            <span>→</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-gray-900 outline-none" />
          </div>
        </div>
      </div>

      {loading && <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading…</div>}

      {!loading && data && (
        <div className="space-y-5">
          {/* Volume row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total" value={data.total} color="border-gray-200 bg-gray-50" />
            <StatCard label="Completed" value={data.completed} color="border-green-200 bg-green-50" />
            <StatCard label="Active" value={data.booked + data.received} sub={`${data.booked} booked · ${data.received} in`} color="border-blue-200 bg-blue-50" />
            <StatCard label="Cancelled" value={data.cancelled} color="border-red-200 bg-red-50" />
            <StatCard label="No Show" value={data.noShow} color="border-gray-200 bg-gray-50" />
            <StatCard label="New Customers" value={data.newCustomers} color="border-purple-200 bg-purple-50" />
          </div>

          {/* Rates + breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Performance rates */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Performance</p>
              <RateBar label="Completion Rate" value={data.completionRate} color="bg-green-500" />
              <RateBar label="Cancellation Rate" value={data.cancellationRate} color="bg-red-400" />
              <RateBar label="No-show Rate" value={data.noShowRate} color="bg-gray-400" />
            </div>

            {/* Service breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service Breakdown</p>
              {Object.entries(data.serviceBreakdown).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-28 shrink-0">{SERVICE_LABELS[type] ?? type}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-700 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-8 text-right">{count}</span>
                  </div>
                )
              })}
              {Object.keys(data.serviceBreakdown).length === 0 && (
                <p className="text-xs text-gray-400">No data</p>
              )}
            </div>
          </div>

          {/* Insights row */}
          {(data.peakHour || data.topService || data.busiestDay) && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Insights</p>
              <div className="flex flex-wrap gap-3">
                {data.peakHour && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                    <p className="text-xs text-yellow-700 font-medium">Peak Hour</p>
                    <p className="text-lg font-bold text-yellow-900">{data.peakHour}</p>
                  </div>
                )}
                {data.topService && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <p className="text-xs text-blue-700 font-medium">Top Service</p>
                    <p className="text-lg font-bold text-blue-900">{SERVICE_LABELS[data.topService.type] ?? data.topService.type}</p>
                    <p className="text-xs text-blue-500">{data.topService.count} bookings</p>
                  </div>
                )}
                {data.busiestDay && from !== to && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                    <p className="text-xs text-purple-700 font-medium">Busiest Day</p>
                    <p className="text-lg font-bold text-purple-900">
                      {format(new Date(data.busiestDay.date + 'T00:00:00'), 'd MMM')}
                    </p>
                    <p className="text-xs text-purple-500">{data.busiestDay.count} bookings</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && data && data.total === 0 && (
        <div className="py-6 text-center text-gray-400 text-sm">No bookings in selected range</div>
      )}
    </div>
  )
}

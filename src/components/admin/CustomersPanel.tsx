'use client'

import { useState } from 'react'
import { clsx } from 'clsx'

type Vehicle = { vehicleNumber: string; vehicleModel?: string }
type Customer = {
  _id: string
  customerId: string
  name?: string
  phoneNumber: string
  totalVisits: number
  lastVisitDate?: string
  vehicles?: Vehicle[]
}

export function CustomersPanel({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState('')

  const filtered = customers.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.phoneNumber ?? '').includes(q) ||
      c.vehicles?.some((v) => (v.vehicleNumber ?? '').toLowerCase().includes(q))
    )
  })

  // Sort: customers with names first, then by visits desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.name && !b.name) return -1
    if (!a.name && b.name) return 1
    return (b.totalVisits ?? 0) - (a.totalVisits ?? 0)
  })

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="🔍  Search by name, phone or vehicle number…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 outline-none bg-white"
      />

      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {sorted.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">No customers found.</div>
        )}
        {sorted.map((c) => {
          const displayName = c.name?.trim() || null
          return (
            <div key={c._id} className={clsx('px-5 py-4 flex items-start justify-between gap-4', !displayName && 'opacity-60')}>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {displayName ? (
                    <p className="font-semibold text-gray-900">{displayName}</p>
                  ) : (
                    <p className="font-semibold text-gray-400 italic">Unknown</p>
                  )}
                  {(c.totalVisits ?? 0) > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {c.totalVisits} visit{c.totalVisits !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">📞 {c.phoneNumber}</p>
                {c.vehicles && c.vehicles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {c.vehicles.map((v) => (
                      <span key={v.vehicleNumber} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-mono">
                        {v.vehicleNumber}{v.vehicleModel ? ` · ${v.vehicleModel}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {c.lastVisitDate && (
                <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  Last: {new Date(c.lastVisitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

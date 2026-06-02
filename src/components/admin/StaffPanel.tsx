'use client'

import { useState } from 'react'

type StaffMember = { _id: string; name: string; role: string; contactDetails?: string; isActive?: boolean }

const ROLE_LABELS: Record<string, string> = {
  advisor: '🧑‍💼 Service Advisor',
  technician: '🔧 Technician',
  manager: '👔 Manager',
  receptionist: '📞 Receptionist',
}

export function StaffPanel({ staff: initial }: { staff: StaffMember[] }) {
  const [staff, setStaff] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', role: 'advisor', contactDetails: '' })

  async function refresh() {
    const res = await fetch('/api/admin/staff')
    const data = await res.json()
    setStaff(data)
  }

  async function addStaff() {
    if (!form.name.trim()) return
    setSaving(true)
    await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setShowForm(false)
    setForm({ name: '', role: 'advisor', contactDetails: '' })
    await refresh()
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !current }),
    })
    await refresh()
  }

  const active = staff.filter((s) => s.isActive !== false)
  const inactive = staff.filter((s) => s.isActive === false)

  return (
    <div className="space-y-4">
      {/* Active staff */}
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {active.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">No staff added yet.</div>
        )}
        {active.map((s) => (
          <div key={s._id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-semibold text-gray-900">{s.name}</p>
              <p className="text-sm text-gray-500">{ROLE_LABELS[s.role] ?? s.role}</p>
              {s.contactDetails && <p className="text-xs text-gray-400 mt-0.5">📞 {s.contactDetails}</p>}
            </div>
            <button
              onClick={() => toggleActive(s._id, true)}
              className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              Deactivate
            </button>
          </div>
        ))}
      </div>

      {/* Add staff form */}
      {showForm ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Add Staff Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none"
            >
              <option value="advisor">Service Advisor</option>
              <option value="technician">Technician</option>
              <option value="manager">Manager</option>
              <option value="receptionist">Receptionist</option>
            </select>
            <input
              placeholder="Phone number (optional)"
              value={form.contactDetails}
              onChange={(e) => setForm({ ...form, contactDetails: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addStaff}
              disabled={saving || !form.name.trim()}
              className="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Adding…' : '+ Add'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-5 py-2 text-gray-500 rounded-xl text-sm hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          + Add Staff Member
        </button>
      )}

      {/* Inactive */}
      {inactive.length > 0 && (
        <details>
          <summary className="text-xs text-gray-400 cursor-pointer">{inactive.length} inactive</summary>
          <div className="mt-2 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {inactive.map((s) => (
              <div key={s._id} className="flex items-center justify-between px-5 py-3 opacity-50">
                <div>
                  <p className="text-sm font-medium text-gray-700">{s.name}</p>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[s.role] ?? s.role}</p>
                </div>
                <button
                  onClick={() => toggleActive(s._id, false)}
                  className="text-xs text-green-600 hover:text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                >
                  Reactivate
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

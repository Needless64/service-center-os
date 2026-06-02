import { clsx } from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  booked:    { label: 'Booked',    className: 'bg-blue-100 text-blue-700' },
  received:  { label: 'Received',  className: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-600' },
  no_show:   { label: 'No Show',   className: 'bg-gray-100 text-gray-500' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}

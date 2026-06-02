import { clsx } from 'clsx'

type Props = {
  label: string
  value: number | string
  color?: 'green' | 'blue' | 'yellow' | 'purple' | 'red' | 'gray'
  icon?: string
}

const colorMap = {
  green: 'bg-green-50 text-green-700 border-green-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  gray: 'bg-gray-50 text-gray-700 border-gray-200',
}

export function StatCard({ label, value, color = 'gray', icon }: Props) {
  return (
    <div className={clsx('rounded-xl border p-5 flex items-center gap-4', colorMap[color])}>
      {icon && <span className="text-2xl">{icon}</span>}
      <div>
        <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-bold mt-0.5">{value}</p>
      </div>
    </div>
  )
}

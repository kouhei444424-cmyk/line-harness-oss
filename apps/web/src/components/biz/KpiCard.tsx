'use client'

interface KpiCardProps {
  label: string
  value: string
  subtext: string
  accent?: 'green' | 'blue' | 'amber' | 'gray'
}

const accentMap = {
  green: 'bg-green-50 text-green-700 border-green-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  gray: 'bg-gray-50 text-gray-700 border-gray-100',
}

export default function KpiCard({ label, value, subtext, accent = 'gray' }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${accentMap[accent]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-2 text-sm opacity-80">{subtext}</p>
    </div>
  )
}

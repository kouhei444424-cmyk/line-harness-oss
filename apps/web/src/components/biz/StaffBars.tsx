'use client'

interface StaffBarItem {
  id: number
  store_id: string
  store_name: string
  name: string
  role: string
  sales: number
  sessions: number
  target: number
  achieved: boolean
  achievement_pct: number
}

interface StaffBarsProps {
  items: StaffBarItem[]
}

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`
}

export default function StaffBars({ items }: StaffBarsProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">トレーナー別売上</h2>
      </div>
      <div className="p-5 space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">対象スタッフがまだ登録されていません。</p>
        ) : (
          items.map((item) => {
            const width = `${Math.min(item.achievement_pct, 100)}%`
            return (
              <div key={item.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <span className="text-xs text-gray-400">{item.store_name}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      売上 {formatCurrency(item.sales)} / 目標 {formatCurrency(item.target)} / セッション {item.sessions.toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.achieved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {item.achieved ? '達成' : '未達'}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${item.achieved ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width }} />
                </div>
                <p className="text-right text-xs font-semibold text-gray-600">{item.achievement_pct}%</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

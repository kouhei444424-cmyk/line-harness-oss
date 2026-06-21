'use client'

interface StoreItem {
  store_id: string
  name: string
  sales: number
  cost_total: number
  profit: number
  members: {
    total: number
    new: number
    cancelled: number
  }
}

interface StoreCompareProps {
  stores: StoreItem[]
}

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`
}

export default function StoreCompare({ stores }: StoreCompareProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">店舗比較</h2>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {stores.map((store) => (
          <div key={store.store_id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900">{store.name}</p>
                <p className="text-xs text-gray-400">{store.store_id}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${store.profit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {store.profit >= 0 ? '黒字' : '赤字'}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>売上</span><span className="font-semibold text-gray-900">{formatCurrency(store.sales)}</span></div>
              <div className="flex justify-between text-gray-600"><span>費用</span><span className="font-semibold text-gray-900">{formatCurrency(store.cost_total)}</span></div>
              <div className="flex justify-between text-gray-600"><span>利益</span><span className={`font-semibold ${store.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(store.profit)}</span></div>
              <div className="flex justify-between text-gray-600"><span>会員数</span><span className="font-semibold text-gray-900">{store.members.total.toLocaleString()}人</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

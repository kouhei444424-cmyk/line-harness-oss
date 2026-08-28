'use client'

interface PlTableProps {
  sales: number
  costRent: number
  costLabor: number
  costAd: number
  costOther: number
  costTotal: number
  profit: number
}

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`
}

function formatRatio(value: number, base: number) {
  if (base <= 0) return '0%'
  return `${Math.round((value / base) * 100)}%`
}

export default function PlTable(props: PlTableProps) {
  const rows = [
    { label: '売上', value: props.sales, ratio: '100%', emphasis: true },
    { label: '家賃', value: props.costRent, ratio: formatRatio(props.costRent, props.sales) },
    { label: '人件費', value: props.costLabor, ratio: formatRatio(props.costLabor, props.sales) },
    { label: '広告費', value: props.costAd, ratio: formatRatio(props.costAd, props.sales) },
    { label: 'その他', value: props.costOther, ratio: formatRatio(props.costOther, props.sales) },
    { label: '費用合計', value: props.costTotal, ratio: formatRatio(props.costTotal, props.sales), emphasis: true },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">損益サマリー</h2>
      </div>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">項目</th>
            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">金額</th>
            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">比率</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className={`px-5 py-3 text-sm ${row.emphasis ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                {row.label}
              </td>
              <td className={`px-5 py-3 text-sm text-right ${row.emphasis ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                {formatCurrency(row.value)}
              </td>
              <td className="px-5 py-3 text-sm text-right text-gray-500">{row.ratio}</td>
            </tr>
          ))}
          <tr className="bg-gray-50">
            <td className="px-5 py-4 text-sm font-semibold text-gray-900">営業利益</td>
            <td className={`px-5 py-4 text-sm text-right font-semibold ${props.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(props.profit)}
            </td>
            <td className={`px-5 py-4 text-sm text-right font-semibold ${props.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatRatio(props.profit, props.sales)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

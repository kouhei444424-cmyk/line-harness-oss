'use client'

import { useMemo, useState } from 'react'
import Header from '@/components/layout/header'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

const RESOURCE_OPTIONS = [
  { value: 'pl', label: '月次収支' },
  { value: 'staff-sales', label: 'スタッフ売上' },
  { value: 'members', label: '会員数' },
  { value: 'contacts', label: '友だち' },
  { value: 'funnels', label: 'ファネル' },
]

const STORE_OPTIONS = [
  { value: 'all', label: '全店舗' },
  { value: 'ogaki', label: '大垣' },
  { value: 'gifu', label: '岐阜' },
  { value: 'ginan', label: '岐南' },
]

const FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' },
]

function getApiKey(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('lh_api_key')
    if (stored) return stored
  }
  return process.env.NEXT_PUBLIC_API_KEY || ''
}

function getRecentMonths() {
  const result: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i += 1) {
    const current = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, '0')
    result.push(`${year}-${month}`)
  }
  return result
}

export default function ExportSettingsPage() {
  const monthOptions = useMemo(() => getRecentMonths(), [])
  const [resource, setResource] = useState('pl')
  const [from, setFrom] = useState(monthOptions[monthOptions.length - 1] ?? '2026-01')
  const [to, setTo] = useState(monthOptions[0] ?? '2026-04')
  const [storeId, setStoreId] = useState('all')
  const [format, setFormat] = useState('json')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleExport = async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const query = new URLSearchParams({
        format,
        from,
        to,
        store_id: storeId,
      })
      const response = await fetch(`${API_URL}/api/export/${resource}?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
        },
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const blob = await response.blob()
      const exportedAt = response.headers.get('X-Exported-At') ?? new Date().toISOString()
      const count = Number(response.headers.get('X-Export-Count') ?? '0')
      const fileName = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? `ageru_${resource}.${format}`

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      setMessage(`${count.toLocaleString()}件をエクスポートしました。${new Date(exportedAt).toLocaleString('ja-JP')}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エクスポートに失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <Header
        title="データエクスポート"
        description="本格システムへの移行や連携に備えて、AGERU の主要データを JSON / CSV で出力します。"
      />

      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">対象データ</span>
            <select value={resource} onChange={(e) => setResource(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {RESOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">店舗</span>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {STORE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">期間 From</span>
            <input type="month" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">期間 To</span>
            <input type="month" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-gray-700">フォーマット</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#06C755' }}
          >
            {loading ? 'エクスポート中...' : 'エクスポート実行'}
          </button>
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

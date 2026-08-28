'use client'

import { useEffect, useState } from 'react'

interface StaffOption {
  id: number
  name: string
  storeName: string
}

interface StaffSalesValue {
  staffId: string
  yearMonth: string
  sales: string
  sessions: string
}

interface StaffSalesModalProps {
  open: boolean
  staffOptions: StaffOption[]
  initialYearMonth: string
  saving: boolean
  error: string
  onClose: () => void
  onSubmit: (values: StaffSalesValue) => void
}

export default function StaffSalesModal(props: StaffSalesModalProps) {
  const [form, setForm] = useState<StaffSalesValue>({
    staffId: props.staffOptions[0] ? String(props.staffOptions[0].id) : '',
    yearMonth: props.initialYearMonth,
    sales: '0',
    sessions: '0',
  })

  useEffect(() => {
    if (!props.open) return
    setForm({
      staffId: props.staffOptions[0] ? String(props.staffOptions[0].id) : '',
      yearMonth: props.initialYearMonth,
      sales: '0',
      sessions: '0',
    })
  }, [props.initialYearMonth, props.open, props.staffOptions])

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">スタッフ売上を入力</h2>
          <button onClick={props.onClose} className="text-sm text-gray-500 hover:text-gray-700">閉じる</button>
        </div>
        <div className="p-6 space-y-4">
          <label className="space-y-1 block">
            <span className="text-sm font-medium text-gray-700">スタッフ</span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.staffId}
              onChange={(e) => setForm({ ...form, staffId: e.target.value })}
            >
              {props.staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>{staff.name} / {staff.storeName}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 block">
            <span className="text-sm font-medium text-gray-700">対象月</span>
            <input
              type="month"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.yearMonth}
              onChange={(e) => setForm({ ...form, yearMonth: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">売上</span>
              <input
                type="number"
                min="0"
                step="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.sales}
                onChange={(e) => setForm({ ...form, sales: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">セッション数</span>
              <input
                type="number"
                min="0"
                step="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.sessions}
                onChange={(e) => setForm({ ...form, sessions: e.target.value })}
              />
            </label>
          </div>
          {props.error && <p className="text-sm text-red-600">{props.error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={props.onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200">キャンセル</button>
          <button
            onClick={() => props.onSubmit(form)}
            disabled={props.saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#06C755' }}
          >
            {props.saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

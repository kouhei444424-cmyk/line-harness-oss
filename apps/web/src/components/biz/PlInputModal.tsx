'use client'

import { useEffect, useState } from 'react'

interface StoreOption {
  id: string
  name: string
}

interface PlInputValue {
  storeId: string
  yearMonth: string
  sales: string
  costRent: string
  costLabor: string
  costAd: string
  costOther: string
  memo: string
}

interface MemberSnapshotValue {
  storeId: string
  yearMonth: string
  total: string
  newMembers: string
  cancelled: string
}

interface PlInputModalProps {
  open: boolean
  stores: StoreOption[]
  initialStoreId: string
  initialYearMonth: string
  saving: boolean
  error: string
  onClose: () => void
  onSubmit: (values: PlInputValue, members: MemberSnapshotValue) => void
}

export default function PlInputModal(props: PlInputModalProps) {
  const [form, setForm] = useState<PlInputValue>({
    storeId: props.initialStoreId,
    yearMonth: props.initialYearMonth,
    sales: '0',
    costRent: '0',
    costLabor: '0',
    costAd: '0',
    costOther: '0',
    memo: '',
  })
  const [members, setMembers] = useState<MemberSnapshotValue>({
    storeId: props.initialStoreId,
    yearMonth: props.initialYearMonth,
    total: '0',
    newMembers: '0',
    cancelled: '0',
  })

  useEffect(() => {
    if (!props.open) return
    setForm((current) => ({ ...current, storeId: props.initialStoreId, yearMonth: props.initialYearMonth }))
    setMembers((current) => ({ ...current, storeId: props.initialStoreId, yearMonth: props.initialYearMonth }))
  }, [props.initialStoreId, props.initialYearMonth, props.open])

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">収支を入力</h2>
          <button onClick={props.onClose} className="text-sm text-gray-500 hover:text-gray-700">閉じる</button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">店舗</span>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.storeId}
                onChange={(e) => {
                  setForm({ ...form, storeId: e.target.value })
                  setMembers({ ...members, storeId: e.target.value })
                }}
              >
                {props.stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">対象月</span>
              <input
                type="month"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.yearMonth}
                onChange={(e) => {
                  setForm({ ...form, yearMonth: e.target.value })
                  setMembers({ ...members, yearMonth: e.target.value })
                }}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['sales', '売上'],
              ['costRent', '家賃'],
              ['costLabor', '人件費'],
              ['costAd', '広告費'],
              ['costOther', 'その他費用'],
            ].map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form[key as keyof PlInputValue] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>

          <label className="space-y-1 block">
            <span className="text-sm font-medium text-gray-700">メモ</span>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-24"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
            />
          </label>

          <div className="rounded-xl border border-gray-200 p-4 space-y-4">
            <p className="text-sm font-semibold text-gray-900">会員数スナップショット</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                ['total', '在籍会員数'],
                ['newMembers', '新規会員数'],
                ['cancelled', '退会数'],
              ].map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={members[key as keyof MemberSnapshotValue] as string}
                    onChange={(e) => setMembers({ ...members, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          </div>

          {props.error && <p className="text-sm text-red-600">{props.error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={props.onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200">キャンセル</button>
          <button
            onClick={() => props.onSubmit(form, members)}
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

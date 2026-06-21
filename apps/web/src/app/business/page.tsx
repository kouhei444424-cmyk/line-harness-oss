'use client'

import { useCallback, useEffect, useState } from 'react'
import Header from '@/components/layout/header'
import KpiCard from '@/components/biz/KpiCard'
import PlTable from '@/components/biz/PlTable'
import StaffBars from '@/components/biz/StaffBars'
import StoreCompare from '@/components/biz/StoreCompare'
import PlInputModal from '@/components/biz/PlInputModal'
import StaffSalesModal from '@/components/biz/StaffSalesModal'
import { api } from '@/lib/api'

type BizStore = {
  store_id: string
  name: string
  sales: number
  cost_rent: number
  cost_labor: number
  cost_ad: number
  cost_other: number
  cost_total: number
  profit: number
  margin_pct: number
  target: number
  achievement_pct: number
  memo: string | null
  members: {
    total: number
    new: number
    cancelled: number
  }
}

type BizSummaryResponse = {
  year_month: string
  stores: BizStore[]
  total: {
    sales: number
    cost_rent: number
    cost_labor: number
    cost_ad: number
    cost_other: number
    cost_total: number
    profit: number
    target: number
    margin_pct: number
    achievement_pct: number
    members: {
      total: number
      new: number
      cancelled: number
    }
  }
}

type BizStaffSalesResponse = {
  year_month: string
  store_id: string
  staff: Array<{
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
  }>
}

const STORE_TABS = [
  { id: 'all', name: '全店舗' },
  { id: 'ogaki', name: '大垣店' },
  { id: 'gifu', name: '岐阜店' },
  { id: 'ginan', name: '岐南店' },
] as const

function getLast12Months() {
  const months: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    months.push({ value: `${year}-${month}`, label: `${year}年${month}月` })
  }
  return months
}

function getPreviousYearMonth(yearMonth: string) {
  const [yearText, monthText] = yearMonth.split('-')
  const date = new Date(Number(yearText), Number(monthText) - 2, 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`
}

function getSummaryScope(summary: BizSummaryResponse) {
  return {
    sales: summary.total.sales,
    costRent: summary.total.cost_rent,
    costLabor: summary.total.cost_labor,
    costAd: summary.total.cost_ad,
    costOther: summary.total.cost_other,
    costTotal: summary.total.cost_total,
    profit: summary.total.profit,
    target: summary.total.target,
    members: summary.total.members,
    achievementPct: summary.total.achievement_pct,
    marginPct: summary.total.margin_pct,
  }
}

export default function BusinessPage() {
  const monthOptions = getLast12Months()
  const [yearMonth, setYearMonth] = useState(monthOptions[0]?.value ?? '2026-04')
  const [storeId, setStoreId] = useState<string>('all')
  const [summary, setSummary] = useState<BizSummaryResponse | null>(null)
  const [previousSummary, setPreviousSummary] = useState<BizSummaryResponse | null>(null)
  const [allStoresSummary, setAllStoresSummary] = useState<BizSummaryResponse | null>(null)
  const [staffSales, setStaffSales] = useState<BizStaffSalesResponse | null>(null)
  const [storeOptions, setStoreOptions] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [plModalOpen, setPlModalOpen] = useState(false)
  const [staffModalOpen, setStaffModalOpen] = useState(false)
  const [plSaving, setPlSaving] = useState(false)
  const [staffSaving, setStaffSaving] = useState(false)
  const [plError, setPlError] = useState('')
  const [staffError, setStaffError] = useState('')

  const loadBusinessData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const previousYearMonth = getPreviousYearMonth(yearMonth)
      const [summaryRes, previousRes, allStoresRes, staffRes, storesRes] = await Promise.all([
        api.biz.summary({ yearMonth, storeId }),
        api.biz.summary({ yearMonth: previousYearMonth, storeId }),
        api.biz.summary({ yearMonth, storeId: 'all' }),
        api.biz.staffSales({ yearMonth, storeId }),
        api.biz.stores(),
      ])

      if (!summaryRes.success) throw new Error(summaryRes.error)
      if (!previousRes.success) throw new Error(previousRes.error)
      if (!allStoresRes.success) throw new Error(allStoresRes.error)
      if (!staffRes.success) throw new Error(staffRes.error)
      if (!storesRes.success) throw new Error(storesRes.error)

      setSummary(summaryRes.data)
      setPreviousSummary(previousRes.data)
      setAllStoresSummary(allStoresRes.data)
      setStaffSales(staffRes.data)
      setStoreOptions(storesRes.data.map((store) => ({ id: store.id, name: store.name })))
    } catch (err) {
      setError(err instanceof Error ? err.message : '事業管理データの読み込みに失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [storeId, yearMonth])

  useEffect(() => {
    loadBusinessData()
  }, [loadBusinessData])

  const handleSavePl = async (
    values: {
      storeId: string
      yearMonth: string
      sales: string
      costRent: string
      costLabor: string
      costAd: string
      costOther: string
      memo: string
    },
    members: {
      storeId: string
      yearMonth: string
      total: string
      newMembers: string
      cancelled: string
    },
  ) => {
    const numericFields = [values.sales, values.costRent, values.costLabor, values.costAd, values.costOther, members.total, members.newMembers, members.cancelled]
    if (numericFields.some((field) => !/^\d+$/.test(field))) {
      setPlError('売上・費用・会員数は 0 以上の整数で入力してください。')
      return
    }

    setPlSaving(true)
    setPlError('')
    try {
      const [plRes, membersRes] = await Promise.all([
        api.biz.upsertPl({
          store_id: values.storeId,
          year_month: values.yearMonth,
          sales: Number(values.sales),
          cost_rent: Number(values.costRent),
          cost_labor: Number(values.costLabor),
          cost_ad: Number(values.costAd),
          cost_other: Number(values.costOther),
          memo: values.memo,
        }),
        api.biz.upsertMembers({
          store_id: members.storeId,
          year_month: members.yearMonth,
          total: Number(members.total),
          new_members: Number(members.newMembers),
          cancelled: Number(members.cancelled),
        }),
      ])

      if (!plRes.success) throw new Error(plRes.error)
      if (!membersRes.success) throw new Error(membersRes.error)

      setPlModalOpen(false)
      await loadBusinessData()
    } catch (err) {
      setPlError(err instanceof Error ? err.message : '保存に失敗しました。')
    } finally {
      setPlSaving(false)
    }
  }

  const handleSaveStaffSales = async (values: { staffId: string; yearMonth: string; sales: string; sessions: string }) => {
    if (![values.sales, values.sessions].every((field) => /^\d+$/.test(field))) {
      setStaffError('売上・セッション数は 0 以上の整数で入力してください。')
      return
    }

    setStaffSaving(true)
    setStaffError('')
    try {
      const res = await api.biz.upsertStaffSales({
        staff_id: Number(values.staffId),
        year_month: values.yearMonth,
        sales: Number(values.sales),
        sessions: Number(values.sessions),
      })
      if (!res.success) throw new Error(res.error)

      setStaffModalOpen(false)
      await loadBusinessData()
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : '保存に失敗しました。')
    } finally {
      setStaffSaving(false)
    }
  }

  const current = summary ? getSummaryScope(summary) : null
  const previous = previousSummary ? getSummaryScope(previousSummary) : null
  const salesChange = current && previous && previous.sales > 0
    ? Math.round(((current.sales - previous.sales) / previous.sales) * 100)
    : 0

  const selectedStoreIdForInput = storeId === 'all' ? 'ogaki' : storeId
  const compareStores: BizStore[] = allStoresSummary?.stores ?? []

  return (
    <div className="space-y-8">
      <Header
        title="事業管理"
        description="店舗収支、会員数、スタッフ売上を横断管理します。"
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlModalOpen(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: '#06C755' }}
            >
              収支を入力
            </button>
            <button
              onClick={() => setStaffModalOpen(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              スタッフ売上を入力
            </button>
          </div>
        }
      />

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">対象月</label>
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {STORE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStoreId(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  storeId === tab.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={storeId === tab.id ? { backgroundColor: '#06C755' } : undefined}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading || !current ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          読み込み中...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard label="売上合計" value={formatCurrency(current.sales)} subtext={`前月比 ${salesChange >= 0 ? '+' : ''}${salesChange}%`} accent="green" />
            <KpiCard label="営業利益" value={formatCurrency(current.profit)} subtext={`利益率 ${current.marginPct}%`} accent="blue" />
            <KpiCard label="在籍会員数" value={`${current.members.total.toLocaleString()}人`} subtext={`新規 +${current.members.new.toLocaleString()} / 退会 -${current.members.cancelled.toLocaleString()}`} accent="amber" />
            <KpiCard label="目標達成率" value={`${current.achievementPct}%`} subtext={`目標 ${formatCurrency(current.target)}`} accent="gray" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6">
            <PlTable
              sales={current.sales}
              costRent={current.costRent}
              costLabor={current.costLabor}
              costAd={current.costAd}
              costOther={current.costOther}
              costTotal={current.costTotal}
              profit={current.profit}
            />
            <StaffBars items={staffSales?.staff ?? []} />
          </div>

          <StoreCompare stores={compareStores} />
        </>
      )}

      <PlInputModal
        open={plModalOpen}
        stores={storeOptions}
        initialStoreId={selectedStoreIdForInput}
        initialYearMonth={yearMonth}
        saving={plSaving}
        error={plError}
        onClose={() => {
          setPlModalOpen(false)
          setPlError('')
        }}
        onSubmit={handleSavePl}
      />

      <StaffSalesModal
        open={staffModalOpen}
        staffOptions={(staffSales?.staff ?? []).map((staff) => ({
          id: staff.id,
          name: staff.name,
          storeName: staff.store_name,
        }))}
        initialYearMonth={yearMonth}
        saving={staffSaving}
        error={staffError}
        onClose={() => {
          setStaffModalOpen(false)
          setStaffError('')
        }}
        onSubmit={handleSaveStaffSales}
      />
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useGroup } from '@/lib/hooks/use-group'
import { useMembers } from '@/lib/hooks/use-members'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { toDate, fmtDateFull } from '@/lib/utils'
import type { Expense } from '@/lib/types'
import type { StatisticsChartsProps } from '@/components/statistics-charts'

// Must stay in sync with the `limit()` used in group-data-context.tsx's expenses subscription.
// When the loaded expense count hits this ceiling, months beyond the oldest loaded record
// may be silently incomplete — we surface that to the user via a banner + MonthPicker label.
const EXPENSE_LIMIT = 200

// ── Lazy-load recharts bundle — keeps it out of the initial JS payload ─────

function ChartSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <div className="h-4 w-48 rounded bg-[var(--muted)] animate-pulse" />
        </div>
        <div className="p-5">
          <div className="h-[220px] rounded-lg bg-[var(--muted)] animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <div className="h-4 w-40 rounded bg-[var(--muted)] animate-pulse" />
            </div>
            <div className="p-5">
              <div className="h-[260px] rounded-lg bg-[var(--muted)] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const StatisticsCharts = dynamic<StatisticsChartsProps>(
  () => import('@/components/statistics-charts'),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

// ── Helpers ────────────────────────────────────────────────────

function formatMonth(year: number, month: number) {
  return `${year}/${String(month + 1).padStart(2, '0')}`
}

function lastNMonths(n: number): { year: number; month: number }[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
}

function filterByMonth(expenses: Expense[], year: number, month: number) {
  return expenses.filter((e) => {
    if (!e.date) return false
    const d = toDate(e.date)
    return d.getFullYear() === year && d.getMonth() === month
  })
}

// ── Month picker ───────────────────────────────────────────────

function MonthPicker({
  value,
  onChange,
  truncatedBefore,
}: {
  value: { year: number; month: number }
  onChange: (_v: { year: number; month: number }) => void
  truncatedBefore: Date | null
}) {
  const months = useMemo(() => lastNMonths(12), [])

  return (
    <select
      value={`${value.year}-${value.month}`}
      onChange={(e) => {
        const [y, m] = e.target.value.split('-').map(Number)
        onChange({ year: y, month: m })
      }}
      className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
      {months.map(({ year, month }) => {
        const monthStart = new Date(year, month, 1)
        const isTruncated = truncatedBefore !== null && monthStart < truncatedBefore
        return (
          <option key={`${year}-${month}`} value={`${year}-${month}`}>
            {formatMonth(year, month)}{isTruncated ? '（資料不完整）' : ''}
          </option>
        )
      })}
    </select>
  )
}

// ── Summary cards ──────────────────────────────────────────────

function DiffBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    if (current === 0) return null
    return <span className="text-[10px] text-[var(--muted-foreground)]">上月無資料</span>
  }
  const diff = Math.round(((current - previous) / previous) * 100)
  if (diff === 0) return <span className="text-[10px] text-[var(--muted-foreground)]">與上月持平</span>
  const isUp = diff > 0
  return (
    <span className={`text-[10px] font-medium ${isUp ? 'text-[var(--destructive)]' : 'text-green-600 dark:text-green-400'}`}>
      {isUp ? '↑' : '↓'} {Math.abs(diff)}% vs 上月
    </span>
  )
}

function SummaryCards({ expenses, prevExpenses }: { expenses: Expense[]; prevExpenses: Expense[] }) {
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const shared = expenses.filter((e) => e.isShared).reduce((s, e) => s + e.amount, 0)
  const personal = total - shared

  const prevTotal = prevExpenses.reduce((s, e) => s + e.amount, 0)
  const prevShared = prevExpenses.filter((e) => e.isShared).reduce((s, e) => s + e.amount, 0)
  const prevPersonal = prevTotal - prevShared

  const items = [
    { label: '總支出', value: total, prev: prevTotal, color: 'var(--primary)' },
    { label: '共同支出', value: shared, prev: prevShared, color: 'oklch(0.55 0.15 220)' },
    { label: '個人支出', value: personal, prev: prevPersonal, color: 'oklch(0.60 0.15 60)' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ label, value, prev, color }) => (
        <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center space-y-1">
          <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
          <p className="text-lg font-bold" style={{ color }}>
            NT$ {value.toLocaleString()}
          </p>
          <DiffBadge current={value} previous={prev} />
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function StatisticsPage() {
  const { loading: groupLoading } = useGroup()
  const { expenses, loading: expLoading } = useExpenses()
  const { members, loading: membersLoading } = useMembers()

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const memberNames = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.name])),
    [members],
  )

  const monthExpenses = useMemo(
    () => filterByMonth(expenses, selectedMonth.year, selectedMonth.month),
    [expenses, selectedMonth],
  )

  const prevMonthExpenses = useMemo(() => {
    const prev = new Date(selectedMonth.year, selectedMonth.month - 1, 1)
    return filterByMonth(expenses, prev.getFullYear(), prev.getMonth())
  }, [expenses, selectedMonth])

  // The shared expenses subscription is capped at EXPENSE_LIMIT. When we hit the cap,
  // the oldest record we have is a hard floor for any month that predates it.
  // expenses are ordered by date desc, so the last item is the oldest loaded.
  const oldestLoadedDate = useMemo<Date | null>(() => {
    if (expenses.length < EXPENSE_LIMIT) return null
    const oldest = expenses[expenses.length - 1]
    return oldest?.date ? toDate(oldest.date) : null
  }, [expenses])

  const isSelectedMonthTruncated = useMemo(() => {
    if (!oldestLoadedDate) return false
    const monthStart = new Date(selectedMonth.year, selectedMonth.month, 1)
    return monthStart < oldestLoadedDate
  }, [oldestLoadedDate, selectedMonth])

  if (groupLoading || expLoading || membersLoading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-3">
        <div className="animate-pulse bg-[var(--muted)] rounded-md h-10 w-40" />
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📊 統計</h1>
        <MonthPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
          truncatedBefore={oldestLoadedDate}
        />
      </div>

      {/* Truncation warning — only surfaces when the shared expense subscription hit
          its limit AND the selected month predates the oldest record we have. */}
      {isSelectedMonthTruncated && oldestLoadedDate && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-4"
          style={{
            backgroundColor: 'color-mix(in oklch, oklch(0.80 0.15 75), var(--card) 80%)',
          }}
        >
          <div className="text-xl leading-none shrink-0" aria-hidden>⚠️</div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-sm font-semibold">資料可能不完整</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              目前只載入最近 {EXPENSE_LIMIT} 筆支出。早於 {fmtDateFull(oldestLoadedDate)} 的資料未顯示，此月份的統計可能不完整。
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <SummaryCards expenses={monthExpenses} prevExpenses={prevMonthExpenses} />

      {/* Charts — lazily loaded to avoid including recharts in initial bundle */}
      <StatisticsCharts
        allExpenses={expenses}
        monthExpenses={monthExpenses}
        prevMonthExpenses={prevMonthExpenses}
        memberNames={memberNames}
        selectedMonth={selectedMonth}
      />
    </div>
  )
}

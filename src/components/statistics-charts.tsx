'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
  type PieLabelRenderProps,
} from 'recharts'
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

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

// ── Color palette ──────────────────────────────────────────────

const PIE_COLORS = [
  'oklch(0.55 0.18 145)', 'oklch(0.55 0.18 220)', 'oklch(0.55 0.18 300)',
  'oklch(0.65 0.18 60)',  'oklch(0.65 0.18 350)', 'oklch(0.55 0.15 185)',
  'oklch(0.60 0.16 270)', 'oklch(0.60 0.16 30)',  'oklch(0.50 0.15 160)',
  'oklch(0.65 0.15 100)',
]

// ── Shared sub-components ──────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-[var(--muted-foreground)]">
      {message}
    </div>
  )
}

// ── Chart components ───────────────────────────────────────────

function TrendChart({ expenses }: { expenses: Expense[] }) {
  const data = useMemo(() => {
    return lastNMonths(6).map(({ year, month }) => ({
      label: formatMonth(year, month),
      total: filterByMonth(expenses, year, month).reduce((s, e) => s + e.amount, 0),
    }))
  }, [expenses])

  const hasData = data.some((d) => d.total > 0)
  if (!hasData) return <EmptyState message="尚無支出資料" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : String(v)} />
        <Tooltip formatter={(value) => [`NT$ ${Number(value).toLocaleString()}`, '支出'] as [string, string]} />
        <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function CategoryPieChart({ expenses }: { expenses: Expense[] }) {
  const data = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) {
      map[e.category] = (map[e.category] ?? 0) + e.amount
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [expenses])

  if (data.length === 0) return <EmptyState message="本月尚無支出資料" />

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90}
          label={(props: PieLabelRenderProps) =>
            (props.percent ?? 0) > 0.04 ? `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%` : ''}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`NT$ ${Number(value).toLocaleString()}`, '金額'] as [string, string]} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function CategoryLeaderboard({ expenses, prevExpenses }: { expenses: Expense[]; prevExpenses: Expense[] }) {
  const data = useMemo(() => {
    const cur: Record<string, number> = {}
    for (const e of expenses) {
      cur[e.category] = (cur[e.category] ?? 0) + e.amount
    }
    const prev: Record<string, number> = {}
    for (const e of prevExpenses) {
      prev[e.category] = (prev[e.category] ?? 0) + e.amount
    }
    const total = Object.values(cur).reduce((s, v) => s + v, 0)
    return Object.entries(cur)
      .map(([cat, amount]) => {
        const prevAmt = prev[cat] ?? 0
        const diff = prevAmt > 0 ? Math.round(((amount - prevAmt) / prevAmt) * 100) : null
        const pct = total > 0 ? Math.round((amount / total) * 100) : 0
        return { cat, amount, prevAmt, diff, pct }
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
  }, [expenses, prevExpenses])

  if (data.length === 0) return <EmptyState message="本月尚無支出資料" />

  return (
    <div className="space-y-2.5">
      {data.map(({ cat, amount, diff, pct }) => (
        <div key={cat} className="flex items-center gap-3 text-sm">
          <div className="w-20 font-medium truncate">{cat}</div>
          <div className="flex-1 h-2 rounded-full bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: 'var(--primary)', opacity: 0.7 }}
            />
          </div>
          <div className="w-24 text-right font-semibold">NT$ {amount.toLocaleString()}</div>
          <div className="w-16 text-right text-xs">
            {diff === null ? (
              <span className="text-[var(--muted-foreground)]">新增</span>
            ) : diff === 0 ? (
              <span className="text-[var(--muted-foreground)]">持平</span>
            ) : (
              <span className={diff > 0 ? 'text-[var(--destructive)]' : 'text-green-600 dark:text-green-400'}>
                {diff > 0 ? '↑' : '↓'} {Math.abs(diff)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function MemberBarChart({ expenses, memberNames }: { expenses: Expense[]; memberNames: Record<string, string> }) {
  const data = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) {
      if (e.isShared) {
        for (const s of e.splits) {
          if (s.isParticipant) {
            map[s.memberId] = (map[s.memberId] ?? 0) + s.shareAmount
          }
        }
      } else {
        map[e.payerId] = (map[e.payerId] ?? 0) + e.amount
      }
    }
    return Object.entries(map)
      .map(([id, amount]) => ({ name: memberNames[id] ?? id, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses, memberNames])

  if (data.length === 0) return <EmptyState message="本月尚無支出資料" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : String(v)} />
        <Tooltip formatter={(value) => [`NT$ ${Number(value).toLocaleString()}`, '分攤金額'] as [string, string]} />
        <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Public component ───────────────────────────────────────────

export interface StatisticsChartsProps {
  allExpenses: Expense[]
  monthExpenses: Expense[]
  prevMonthExpenses: Expense[]
  memberNames: Record<string, string>
  selectedMonth: { year: number; month: number }
}

export default function StatisticsCharts({
  allExpenses,
  monthExpenses,
  prevMonthExpenses,
  memberNames,
  selectedMonth,
}: StatisticsChartsProps) {
  return (
    <>
      {/* Trend — full width */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold text-sm text-[var(--muted-foreground)]">📈 月支出趨勢（近 6 個月）</h2>
        </div>
        <div className="p-5">
          <TrendChart expenses={allExpenses} />
        </div>
      </div>

      {/* Category leaderboard with month-over-month comparison */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold text-sm text-[var(--muted-foreground)]">
            🏆 類別排行榜 — {selectedMonth.year}/{String(selectedMonth.month + 1).padStart(2, '0')}（vs 上月）
          </h2>
        </div>
        <div className="p-5">
          <CategoryLeaderboard expenses={monthExpenses} prevExpenses={prevMonthExpenses} />
        </div>
      </div>

      {/* Category pie + Member bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <h2 className="font-semibold text-sm text-[var(--muted-foreground)]">
              🥧 類別分布 — {selectedMonth.year}/{String(selectedMonth.month + 1).padStart(2, '0')}
            </h2>
          </div>
          <div className="p-5">
            <CategoryPieChart expenses={monthExpenses} />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <h2 className="font-semibold text-sm text-[var(--muted-foreground)]">
              👥 成員分攤 — {selectedMonth.year}/{String(selectedMonth.month + 1).padStart(2, '0')}
            </h2>
          </div>
          <div className="p-5">
            <MemberBarChart expenses={monthExpenses} memberNames={memberNames} />
          </div>
        </div>
      </div>
    </>
  )
}

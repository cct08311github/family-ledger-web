'use client'

import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
  type PieLabelRenderProps,
} from 'recharts'
import { useGroup } from '@/lib/hooks/use-group'
import { useMembers } from '@/lib/hooks/use-members'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

// ── Helpers ────────────────────────────────────────────────────

function formatMonth(year: number, month: number) {
  return `${year}/${String(month + 1).padStart(2, '0')}`
}

/** Build the last N months as { year, month } tuples, oldest first */
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

// ── Chart components ───────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-[var(--muted-foreground)]">
      {message}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)]">
        <h2 className="font-semibold text-sm text-[var(--muted-foreground)]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

/** 月支出趨勢折線圖 (past 6 months) */
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

/** 類別分布圓餅圖 */
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

/** 成員支出比較長條圖 */
function MemberBarChart({ expenses, memberNames }: { expenses: Expense[]; memberNames: Record<string, string> }) {
  const data = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) {
      if (e.isShared) {
        // Shared: distribute by each participant's share amount
        for (const s of e.splits) {
          if (s.isParticipant) {
            map[s.memberId] = (map[s.memberId] ?? 0) + s.shareAmount
          }
        }
      } else {
        // Personal: full amount attributed to the payer only
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

// ── Month picker ───────────────────────────────────────────────

function MonthPicker({ value, onChange }: { value: { year: number; month: number }; onChange: (v: { year: number; month: number }) => void }) {
  const months = useMemo(() => lastNMonths(12), [])

  return (
    <select
      value={`${value.year}-${value.month}`}
      onChange={(e) => {
        const [y, m] = e.target.value.split('-').map(Number)
        onChange({ year: y, month: m })
      }}
      className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
      {months.map(({ year, month }) => (
        <option key={`${year}-${month}`} value={`${year}-${month}`}>
          {formatMonth(year, month)}
        </option>
      ))}
    </select>
  )
}

// ── Summary cards ──────────────────────────────────────────────

function SummaryCards({ expenses }: { expenses: Expense[] }) {
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const shared = expenses.filter((e) => e.isShared).reduce((s, e) => s + e.amount, 0)
  const personal = total - shared

  const items = [
    { label: '總支出', value: total, color: 'var(--primary)' },
    { label: '共同支出', value: shared, color: 'oklch(0.55 0.15 220)', note: '含分攤' },
    { label: '個人支出', value: personal, color: 'oklch(0.60 0.15 60)', note: '自行負擔' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ label, value, color, note }) => (
        <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">{label}</p>
          <p className="text-lg font-bold" style={{ color }}>
            NT$ {value.toLocaleString()}
          </p>
          {note && <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{note}</p>}
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function StatisticsPage() {
  const { group, loading: groupLoading } = useGroup()
  const { expenses, loading: expLoading } = useExpenses(group?.id)
  const members = useMembers(group?.id)

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

  if (groupLoading || expLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📊 統計</h1>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Summary */}
      <SummaryCards expenses={monthExpenses} />

      {/* Trend (always show 6-month window regardless of selected month) */}
      <SectionCard title="📈 月支出趨勢（近 6 個月）">
        <TrendChart expenses={expenses} />
      </SectionCard>

      {/* Category pie */}
      <SectionCard title={`🥧 類別分布 — ${formatMonth(selectedMonth.year, selectedMonth.month)}`}>
        <CategoryPieChart expenses={monthExpenses} />
      </SectionCard>

      {/* Member bar */}
      <SectionCard title={`👥 成員分攤 — ${formatMonth(selectedMonth.year, selectedMonth.month)}`}>
        <MemberBarChart expenses={monthExpenses} memberNames={memberNames} />
      </SectionCard>
    </div>
  )
}

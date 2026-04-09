'use client'

import { useMemo } from 'react'
import type { Expense } from '@/lib/types'

interface FilterChipsProps {
  expenses: Expense[]
  dateStart: string
  dateEnd: string
  categoryFilter: string
  onDateRangeChange: (_start: string, _end: string) => void
  onCategoryChange: (_cat: string) => void
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function thisWeekRange(): [string, string] {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return [fmt(monday), todayStr()]
}

function thisMonthRange(): [string, string] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return [fmt(start), todayStr()]
}

export function FilterChips({
  expenses,
  dateStart,
  dateEnd,
  categoryFilter,
  onDateRangeChange,
  onCategoryChange,
}: FilterChipsProps) {
  // Derive top 5 categories by total amount
  const topCategories = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat)
  }, [expenses])

  // Active state detection
  const [weekStart, weekEnd] = thisWeekRange()
  const [monthStart, monthEnd] = thisMonthRange()
  const isThisWeek = dateStart === weekStart && dateEnd === weekEnd
  const isThisMonth = dateStart === monthStart && dateEnd === monthEnd

  function toggleDateRange(start: string, end: string, currentlyActive: boolean) {
    if (currentlyActive) {
      onDateRangeChange('', '')
    } else {
      onDateRangeChange(start, end)
    }
  }

  function toggleCategory(cat: string) {
    onCategoryChange(cat === categoryFilter ? '' : cat)
  }

  const chipBase =
    'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap'
  const activeChip = 'bg-[var(--primary)] text-white'
  const inactiveChip =
    'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]'

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      <button
        onClick={() => toggleDateRange(weekStart, weekEnd, isThisWeek)}
        className={`${chipBase} ${isThisWeek ? activeChip : inactiveChip}`}
      >
        📅 本週
      </button>
      <button
        onClick={() => toggleDateRange(monthStart, monthEnd, isThisMonth)}
        className={`${chipBase} ${isThisMonth ? activeChip : inactiveChip}`}
      >
        🗓️ 本月
      </button>

      {topCategories.length > 0 && (
        <div className="shrink-0 w-px bg-[var(--border)] mx-1 self-stretch" aria-hidden />
      )}

      {topCategories.map((cat) => (
        <button
          key={cat}
          onClick={() => toggleCategory(cat)}
          className={`${chipBase} ${cat === categoryFilter ? activeChip : inactiveChip}`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

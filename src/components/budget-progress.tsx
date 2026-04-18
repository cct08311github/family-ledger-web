'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { currency } from '@/lib/utils'
import {
  getMonthStart,
  getDaysInMonth,
  calculateMonthTotal,
  classifyBudgetStatus,
} from '@/lib/budget'
import type { Expense, FamilyGroup } from '@/lib/types'

interface BudgetProgressProps {
  group: FamilyGroup | null
  expenses: Expense[]
}

export function BudgetProgress({ group, expenses }: BudgetProgressProps) {
  const budget = group?.monthlyBudget ?? null

  // Single memo keeps `now`-derived values and `monthTotal` consistent across
  // renders. Previously these were split, causing a (rare) mismatch at the
  // midnight month boundary where `dayOfMonth` refreshed but `monthTotal`
  // stayed cached from the prior month. Issue #189.
  const derived = useMemo(() => {
    const now = new Date()
    const dayOfMonth = now.getDate()
    const daysInMonth = getDaysInMonth(now)
    const monthStart = getMonthStart(now)
    const monthTotal = calculateMonthTotal(expenses, monthStart)
    return { dayOfMonth, daysInMonth, monthTotal }
  }, [expenses])
  const { dayOfMonth, daysInMonth, monthTotal } = derived

  const status = budget != null
    ? classifyBudgetStatus({
        budget,
        spent: monthTotal,
        dayOfMonth,
        daysInMonth,
        formatCurrency: currency,
      })
    : null

  // Nothing set yet — show a minimal prompt
  if (budget == null || status == null) {
    return (
      <Link
        href="/settings"
        className="block card p-4 border-dashed hover:border-[var(--primary)] transition-colors"
      >
        <div className="flex items-center gap-3 text-sm">
          <span className="text-2xl">🎯</span>
          <div className="flex-1">
            <div className="font-medium">設定月度預算</div>
            <div className="text-xs text-[var(--muted-foreground)]">
              到設定頁面設定目標金額，追蹤本月進度
            </div>
          </div>
          <span className="text-[var(--muted-foreground)]">→</span>
        </div>
      </Link>
    )
  }

  // Color scheme: green (on pace) → amber (over pace, under budget) → red (over budget)
  const barColor = status.kind === 'overBudget'
    ? 'var(--destructive)'
    : status.kind === 'overPace'
    ? 'oklch(0.65 0.18 60)' // amber
    : 'var(--primary)'

  const barWidth = Math.min(status.percentUsed, 100)

  return (
    <div className="card p-5 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          🎯 月度預算
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">
          {dayOfMonth} / {daysInMonth} 日
        </div>
      </div>

      {/* Numbers row */}
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-black" style={{ color: barColor }}>
            {currency(monthTotal)}
          </span>
          <span className="text-sm text-[var(--muted-foreground)] ml-2">
            / {currency(budget)}
          </span>
        </div>
        <div className={`text-sm font-bold`} style={{ color: barColor }}>
          {status.percentUsed}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-[var(--muted)] overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
        {/* Expected pace marker */}
        {!status.overBudget && (
          <div
            className="absolute top-0 h-full w-0.5 bg-[var(--foreground)] opacity-40"
            style={{ left: `${Math.min((dayOfMonth / daysInMonth) * 100, 100)}%` }}
            title="目前應有的進度"
          />
        )}
      </div>

      {/* Status line */}
      <div className="text-xs text-[var(--muted-foreground)] flex items-center justify-between">
        <span>
          {status.kind === 'overBudget' ? (
            <span className="text-[var(--destructive)] font-medium">⚠️ 已超出本月預算</span>
          ) : status.kind === 'overPace' ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">⚡ 超過預期進度</span>
          ) : (
            <span className="text-green-600 dark:text-green-400 font-medium">✓ 在預算範圍內</span>
          )}
        </span>
        <span>{status.statusText}</span>
      </div>
    </div>
  )
}

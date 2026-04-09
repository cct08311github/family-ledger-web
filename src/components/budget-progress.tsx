'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { currency, toDate } from '@/lib/utils'
import type { Expense, FamilyGroup } from '@/lib/types'

interface BudgetProgressProps {
  group: FamilyGroup | null
  expenses: Expense[]
}

export function BudgetProgress({ group, expenses }: BudgetProgressProps) {
  const budget = group?.monthlyBudget ?? null

  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  const monthTotal = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return expenses
      .filter((e) => toDate(e.date) >= start)
      .reduce((s, e) => s + e.amount, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses])

  // Expected cumulative spending if linearly paced
  const expectedByNow = budget != null ? (budget * dayOfMonth) / daysInMonth : 0
  const percentUsed = budget && budget > 0 ? Math.round((monthTotal / budget) * 100) : 0
  const overBudget = budget != null && monthTotal > budget
  const overPace = budget != null && monthTotal > expectedByNow

  // Nothing set yet — show a minimal prompt
  if (budget == null) {
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
  const barColor = overBudget
    ? 'var(--destructive)'
    : overPace
    ? 'oklch(0.65 0.18 60)' // amber
    : 'var(--primary)'

  const statusText = overBudget
    ? `超支 ${currency(monthTotal - budget)}`
    : overPace
    ? `超速 ${currency(Math.round(monthTotal - expectedByNow))}`
    : `領先 ${currency(Math.round(expectedByNow - monthTotal))}`

  const barWidth = Math.min(percentUsed, 100)

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
          {percentUsed}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-[var(--muted)] overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
        {/* Expected pace marker */}
        {!overBudget && (
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
          {overBudget ? (
            <span className="text-[var(--destructive)] font-medium">⚠️ 已超出本月預算</span>
          ) : overPace ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">⚡ 超過預期進度</span>
          ) : (
            <span className="text-green-600 dark:text-green-400 font-medium">✓ 在預算範圍內</span>
          )}
        </span>
        <span>{statusText}</span>
      </div>
    </div>
  )
}

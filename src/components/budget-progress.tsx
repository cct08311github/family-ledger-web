'use client'

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

  // Compute on every render (no useMemo). Rationale:
  // - filter+reduce over ~200 expenses is < 1ms, memoization overhead is not worth it
  // - crucially, `new Date()` must re-read every render so idle-past-midnight
  //   updates dayOfMonth / month boundary (the original memoized design left
  //   `now` frozen until expenses changed; Issue #189 refactor v1 had the same
  //   flaw — reviewer caught it)
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = getDaysInMonth(now)
  const monthStart = getMonthStart(now)
  const monthTotal = calculateMonthTotal(expenses, monthStart)

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

      {/* Month-end projection (Issue #203). Hidden if nothing has been spent
          yet — an "estimate" of 0 is noise. Early in the month the projection
          is volatile, so we badge it "估算中" when dayOfMonth ≤ 2. */}
      {monthTotal > 0 && (
        <div className="text-xs flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <span className="text-[var(--muted-foreground)]">
            按目前速度，月底預計花費
            {dayOfMonth <= 2 && (
              <span className="ml-1 opacity-60">（估算中）</span>
            )}
          </span>
          <span
            className={`font-semibold ${
              status.projectedOverBudget
                ? 'text-[var(--destructive)]'
                : 'text-[var(--foreground)]'
            }`}
          >
            {currency(Math.round(status.projected))}
            <span className="ml-1 text-[var(--muted-foreground)] font-normal">
              ({status.projectedPercent}%)
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

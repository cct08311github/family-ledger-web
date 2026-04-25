'use client'

import { useMemo } from 'react'
import { checkBudgetOverrun } from '@/lib/budget-overrun'
import { currency } from '@/lib/utils'
import type { Expense, FamilyGroup } from '@/lib/types'

interface BudgetOverrunAlertProps {
  expenses: Expense[]
  group: FamilyGroup | null | undefined
}

/**
 * Predictive budget banner (Issue #321). Renders only when current pace
 * is meaningfully on track to exceed the monthly budget — uses a 5%
 * buffer to absorb early-month noise. Different from BudgetProgress
 * (passive snapshot) and MonthProjection (always-on forecast); this is
 * action-triggering — appears only when the user can still change course.
 */
export function BudgetOverrunAlert({ expenses, group }: BudgetOverrunAlertProps) {
  const data = useMemo(
    () => checkBudgetOverrun({ expenses, monthlyBudget: group?.monthlyBudget }),
    [expenses, group?.monthlyBudget],
  )

  if (!data) return null

  const isCritical = data.severity === 'critical'
  const overrunPctText = `${Math.round(data.overrunPct * 100)}%`

  const actionableMessage =
    data.requiredDailyToHitBudget < 0
      ? '已超預算，無法在月內回到目標'
      : data.daysRemaining === 0
        ? `本月剩 0 天，已超預算 ${currency(data.overrun)}`
        : `剩 ${data.daysRemaining} 天，每日需省下 ${currency(
            Math.max(0, data.currentDailyPace - data.requiredDailyToHitBudget),
          )} 才能達標`

  return (
    <div
      className="rounded-2xl border p-4 space-y-1.5 animate-fade-up"
      style={{
        borderColor: isCritical
          ? 'color-mix(in oklch, var(--destructive), var(--card) 50%)'
          : 'color-mix(in oklch, oklch(0.80 0.15 75), var(--card) 60%)',
        backgroundColor: isCritical
          ? 'color-mix(in oklch, var(--destructive), var(--card) 80%)'
          : 'color-mix(in oklch, oklch(0.85 0.10 75), var(--card) 80%)',
      }}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>{isCritical ? '🚨' : '⚠️'}</span>
        <span>
          預警：預估月底 <span className="font-bold">{currency(data.projectedTotal)}</span>，
          超預算 {overrunPctText}（{currency(data.overrun)}）
        </span>
      </div>
      <p className="text-xs text-[var(--foreground)]">{actionableMessage}</p>
      <p className="text-[11px] text-[var(--muted-foreground)]">
        目前每日平均 {currency(data.currentDailyPace)}｜預算 {currency(data.budget)}
      </p>
    </div>
  )
}

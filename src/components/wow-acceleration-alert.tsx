'use client'

import { useMemo } from 'react'
import { checkWowAcceleration } from '@/lib/wow-acceleration'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface WowAccelerationAlertProps {
  expenses: Expense[]
}

/**
 * Short-horizon WoW acceleration banner (Issue #331). Triggers when
 * this-week's extrapolated total ≥1.5× last week. Acts as an early
 * version of BudgetOverrunAlert (#321) — week-level signal often
 * precedes month-level budget breach by 1-2 weeks.
 */
export function WowAccelerationAlert({ expenses }: WowAccelerationAlertProps) {
  const data = useMemo(
    () => checkWowAcceleration({ expenses }),
    [expenses],
  )

  if (!data) return null

  const isSharp = data.severity === 'sharp'
  const pctText = `+${Math.round(data.deltaPct * 100)}%`

  return (
    <div
      className="rounded-2xl border p-4 space-y-1.5 animate-fade-up"
      style={{
        borderColor: isSharp
          ? 'color-mix(in oklch, var(--destructive), var(--card) 60%)'
          : 'color-mix(in oklch, oklch(0.80 0.15 75), var(--card) 65%)',
        backgroundColor: isSharp
          ? 'color-mix(in oklch, var(--destructive), var(--card) 88%)'
          : 'color-mix(in oklch, oklch(0.85 0.10 75), var(--card) 88%)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>⚡</span>
        <span>
          本週花費加速：
          <span className="font-bold">{currency(data.currentWeekTotal)}</span>{' '}
          <span className="text-xs">（上週 {currency(data.previousWeekTotal)}，{pctText}）</span>
        </span>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        已過 {data.daysIntoWeek} 天｜照目前速度全週估計{' '}
        <span className="text-[var(--foreground)]">{currency(data.estimatedFullWeek)}</span>
      </p>
    </div>
  )
}

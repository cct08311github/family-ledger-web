'use client'

import { useMemo } from 'react'
import { analyzeYearRecap } from '@/lib/year-recap'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface YearRecapProps {
  expenses: Expense[]
}

/**
 * Year-to-date overview (Issue #305). The only annual-cadence widget on
 * the home page — fills the time-axis gap left by month-and-shorter
 * widgets. Renders silently before day 30 of the year, where linear
 * extrapolation is too noisy to be useful.
 */
export function YearRecap({ expenses }: YearRecapProps) {
  const data = useMemo(
    () => analyzeYearRecap({ expenses }),
    [expenses],
  )

  if (!data) return null

  const yearProgressPct = Math.round((data.daysSoFarInYear / data.daysInYear) * 100)

  let comparison: { label: string; color: string } | null = null
  if (
    data.lastYearSamePeriodTotal !== null &&
    data.vsLastYearSameDate !== null &&
    data.lastYearSamePeriodTotal > 0
  ) {
    const pct = Math.round(
      (data.vsLastYearSameDate / data.lastYearSamePeriodTotal) * 100,
    )
    if (pct > 0) {
      comparison = {
        label: `↑ 比去年同期多 ${pct}%（去年 ${currency(data.lastYearSamePeriodTotal)}）`,
        color: 'var(--destructive)',
      }
    } else if (pct < 0) {
      comparison = {
        label: `↓ 比去年同期少 ${Math.abs(pct)}%（去年 ${currency(data.lastYearSamePeriodTotal)}）`,
        color: 'var(--primary)',
      }
    } else {
      comparison = {
        label: `→ 與去年同期相當（去年 ${currency(data.lastYearSamePeriodTotal)}）`,
        color: 'var(--muted-foreground)',
      }
    }
  }

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--muted-foreground)]">
          📅 {data.year} 年度回顧
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">
          已過 {yearProgressPct}% ({data.daysSoFarInYear}/{data.daysInYear} 天)
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-[var(--foreground)]">
          本年累計 <span className="font-semibold">{currency(data.ytdTotal)}</span>
        </p>
        <p className="text-base text-[var(--foreground)]">
          預估全年{' '}
          <span className="font-semibold text-[var(--primary)]">
            {currency(data.projectedAnnual)}
          </span>
        </p>
      </div>

      {comparison && (
        <p className="text-xs" style={{ color: comparison.color }}>
          {comparison.label}
        </p>
      )}

      <div className="pt-2 border-t border-[var(--border)] flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
        {data.topCategory && (
          <span>
            主類別：{data.topCategory.name} {currency(data.topCategory.amount)} (
            {Math.round(data.topCategory.pct * 100)}%)
          </span>
        )}
        {data.topMonth && (
          <span>
            最高月：{data.topMonth.month} 月 {currency(data.topMonth.amount)}
          </span>
        )}
      </div>
    </div>
  )
}

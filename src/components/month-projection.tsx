'use client'

import { useMemo } from 'react'
import { forecastCurrentMonth } from '@/lib/month-projection'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface MonthProjectionProps {
  expenses: Expense[]
}

/**
 * Current-month spending projection (Issue #296). Linear pace extrapolation
 * with comparison to the trailing 3-month average. Bridges the gap between
 * BudgetProgress (snapshot vs budget) and MoneyDiary (retrospective).
 *
 * Renders silently when input is too thin: < 3 days into month, or no
 * spending yet. The point is actionable foresight, not noise.
 */
export function MonthProjection({ expenses }: MonthProjectionProps) {
  const data = useMemo(
    () => forecastCurrentMonth({ expenses }),
    [expenses],
  )

  if (!data) return null

  const {
    daysSoFar,
    daysInMonth,
    spentSoFar,
    projectedTotal,
    monthProgress,
    historicalAverage,
    vsHistorical,
    monthsAveraged,
  } = data

  const progressPct = Math.round(monthProgress * 100)
  const trendArrow =
    vsHistorical === null
      ? null
      : vsHistorical > 0
        ? '↑'
        : vsHistorical < 0
          ? '↓'
          : '→'
  const trendColor =
    vsHistorical === null
      ? 'var(--muted-foreground)'
      : vsHistorical > 0
        ? 'var(--destructive)'
        : 'var(--primary)'

  const vsHistoricalPct =
    historicalAverage !== null && historicalAverage > 0
      ? Math.round(((projectedTotal - historicalAverage) / historicalAverage) * 100)
      : null

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--muted-foreground)]">
          🔮 月底支出預估
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">
          已過 {progressPct}% ({daysSoFar}/{daysInMonth} 天)
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-[var(--foreground)]">
          目前已花 <span className="font-semibold">{currency(spentSoFar)}</span>
        </p>
        <p className="text-base text-[var(--foreground)]">
          依目前速度，月底預估{' '}
          <span className="font-semibold text-[var(--primary)]">
            {currency(projectedTotal)}
          </span>
        </p>
      </div>

      {historicalAverage !== null && vsHistoricalPct !== null && trendArrow && (
        <p className="text-xs" style={{ color: trendColor }}>
          {trendArrow} 比過去 {monthsAveraged} 個月平均
          {vsHistoricalPct > 0 ? '多' : vsHistoricalPct < 0 ? '少' : '相當'}{' '}
          {Math.abs(vsHistoricalPct)}% (
          {currency(historicalAverage)})
        </p>
      )}

      <div className="relative h-2 w-full rounded-full bg-[var(--muted)]">
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${Math.min(100, progressPct)}%`,
            backgroundColor: 'color-mix(in oklch, var(--primary) 50%, transparent)',
          }}
          aria-label="月份進度"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-px h-3"
          style={{
            left: `${Math.min(100, Math.round((spentSoFar / projectedTotal) * 100 * (daysSoFar / daysInMonth)))}%`,
            backgroundColor: 'var(--foreground)',
            opacity: 0.4,
          }}
          aria-hidden
        />
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { compareSameMonthLastYear, type CategoryShift } from '@/lib/same-month-last-year'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface SameMonthLastYearProps {
  expenses: Expense[]
}

function describeShift(s: CategoryShift): string {
  if (s.previous === 0) {
    return `${s.category} 新增 ${currency(s.current)}`
  }
  if (s.current === 0) {
    return `${s.category} 消失（去年 ${currency(s.previous)}）`
  }
  if (s.deltaPct === null) return s.category
  const pct = Math.round(s.deltaPct * 100)
  const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→'
  return `${arrow} ${s.category} ${pct > 0 ? '+' : ''}${pct}% (${currency(s.previous)} → ${currency(s.current)})`
}

/**
 * Year-over-year same-month compare (Issue #323). Surfaces seasonal
 * patterns invisible in MoM (CategoryMoM) — winter vs winter, holiday
 * season, summer break. Useful for asking "is this month's spending
 * normal for our family?"
 */
export function SameMonthLastYear({ expenses }: SameMonthLastYearProps) {
  const data = useMemo(
    () => compareSameMonthLastYear({ expenses }),
    [expenses],
  )

  if (!data) return null

  const pctText =
    data.deltaPct !== null
      ? `${data.deltaPct > 0 ? '+' : ''}${Math.round(data.deltaPct * 100)}%`
      : ''
  const trendColor =
    data.delta > 0
      ? 'var(--destructive)'
      : data.delta < 0
        ? 'var(--primary)'
        : 'var(--muted-foreground)'
  const trendArrow = data.delta > 0 ? '↑' : data.delta < 0 ? '↓' : '→'

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        📆 本月 vs 去年同月（{data.lastYearLabel}）
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="space-y-0.5">
          <div className="text-[11px] text-[var(--muted-foreground)]">本月</div>
          <div className="font-semibold text-[var(--foreground)]">
            {currency(data.current.total)}
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)]">
            {data.current.count} 筆
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[11px] text-[var(--muted-foreground)]">去年同月</div>
          <div className="font-semibold text-[var(--foreground)]">
            {currency(data.lastYear.total)}
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)]">
            {data.lastYear.count} 筆
          </div>
        </div>
      </div>

      <p className="text-sm" style={{ color: trendColor }}>
        {trendArrow} {data.delta > 0 ? '多' : data.delta < 0 ? '少' : '相當'}{' '}
        {currency(Math.abs(data.delta))}
        {pctText && ` (${pctText})`}
      </p>

      {data.topCategoryShift.length > 0 && (
        <div className="pt-2 border-t border-[var(--border)] space-y-1">
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
            類別變化
          </p>
          {data.topCategoryShift.map((s) => (
            <p
              key={s.category}
              className="text-xs text-[var(--foreground)]"
            >
              {describeShift(s)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

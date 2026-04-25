'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { forecastNextMonthLockedIn } from '@/lib/next-month-locked-in'
import { currency } from '@/lib/utils'
import type { RecurringExpense } from '@/lib/types'

interface NextMonthLockedInProps {
  recurringTemplates: RecurringExpense[]
  /** Limit list items shown. Default 6. */
  itemLimit?: number
}

/**
 * Forward-looking floor of next-calendar-month spending (Issue #317).
 * Built from already-confirmed RecurringExpense templates so it's a
 * commitment view, not a guess. Distinct from MonthProjection (#296)
 * which extrapolates *current* month's pace; this projects *next*
 * month from locked-in templates.
 */
export function NextMonthLockedIn({
  recurringTemplates,
  itemLimit = 6,
}: NextMonthLockedInProps) {
  const data = useMemo(
    () => forecastNextMonthLockedIn({ recurringTemplates }),
    [recurringTemplates],
  )

  if (!data) return null

  const visibleItems = data.items.slice(0, itemLimit)
  const moreCount = data.items.length - visibleItems.length

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-semibold text-[var(--muted-foreground)]">
          🔒 下個月固定支出 · {data.monthLabel}
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">
          {data.count + data.variableCount} 筆已知
        </div>
      </div>

      {data.totalEstimated !== null ? (
        <p className="text-sm">
          預估{' '}
          <span className="text-base font-semibold text-[var(--primary)]">
            {currency(data.totalEstimated)}
          </span>
          {data.variableCount > 0 && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {' '}
              + {data.variableCount} 筆浮動
            </span>
          )}
        </p>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          全部為浮動金額（{data.variableCount} 筆）
        </p>
      )}

      <ul className="divide-y divide-[var(--border)]">
        {visibleItems.map((item, i) => (
          <li
            key={`${item.templateId}-${item.expectedDate}-${i}`}
            className="flex items-center justify-between gap-2 py-1.5 text-xs"
          >
            <span className="text-[var(--muted-foreground)] w-12 flex-shrink-0">
              {item.expectedDate.slice(5)}
            </span>
            <span className="text-[var(--foreground)] flex-1 truncate">
              {item.description}
            </span>
            <span className="text-[var(--foreground)] flex-shrink-0">
              {item.amount !== null ? currency(item.amount) : '—'}
            </span>
          </li>
        ))}
      </ul>

      {moreCount > 0 && (
        <Link
          href="/settings/recurring"
          className="block text-xs text-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition pt-1"
        >
          + 還有 {moreCount} 筆 · 管理 →
        </Link>
      )}
    </div>
  )
}

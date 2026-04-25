'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { analyzeBiggestExpense } from '@/lib/biggest-expense-spotlight'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface BiggestExpenseSpotlightProps {
  expenses: Expense[]
}

function pctileLabel(p: number): string {
  if (p >= 0.95) return '比過去 P95 還高（前 5% 大筆）'
  if (p >= 0.85) return `比過去 P${Math.round(p * 100)} 還高（前 ${Math.round((1 - p) * 100)}% 大筆）`
  if (p >= 0.5) return `落在過去 P${Math.round(p * 100)}（中段）`
  return `比過去 P${Math.round(p * 100)} 還低（小於一半的歷史紀錄）`
}

/**
 * Surfaces the largest single-line expense of the current month with a
 * percentile rank against trailing 6-month distribution. Emotionally
 * different from MoneyDiary's narrative — this one says "this purchase
 * stood out" and shows just how much.
 */
export function BiggestExpenseSpotlight({ expenses }: BiggestExpenseSpotlightProps) {
  const data = useMemo(
    () => analyzeBiggestExpense({ expenses }),
    [expenses],
  )

  if (!data) return null

  const { biggest, monthTop, pctile } = data
  const others = monthTop.slice(1)

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        💎 本月最大筆支出 · {data.monthLabel}
      </div>

      <Link
        href={`/expense/${biggest.id}`}
        className="block hover:opacity-80 transition"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-2xl md:text-3xl font-bold text-[var(--primary)]">
            {currency(biggest.amount)}
          </span>
        </div>
        <p className="text-sm text-[var(--foreground)] mt-1">
          {biggest.description}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {biggest.category} · {biggest.dateLabel} · {biggest.payerName}付
        </p>
      </Link>

      {pctile !== null && (
        <p className="text-xs text-[var(--muted-foreground)] italic">
          ★ {pctileLabel(pctile)}
        </p>
      )}

      {others.length > 0 && (
        <div className="pt-2 border-t border-[var(--border)] space-y-1">
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
            其他大筆
          </p>
          {others.map((e) => (
            <Link
              key={e.id}
              href={`/expense/${e.id}`}
              className="flex items-center justify-between gap-2 text-xs hover:bg-[var(--muted)] transition rounded px-2 -mx-2 py-1"
            >
              <span className="text-[var(--foreground)] truncate">
                {e.description}
              </span>
              <span className="text-[var(--muted-foreground)] flex-shrink-0">
                {currency(e.amount)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

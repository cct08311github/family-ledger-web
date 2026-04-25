'use client'

import { useMemo } from 'react'
import { analyzeCategoryMoM, type CategoryChange } from '@/lib/category-mom'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface CategoryMoMProps {
  expenses: Expense[]
  /** How many top changes to surface. Default 3. */
  limit?: number
}

function changeIcon(c: CategoryChange): string {
  switch (c.kind) {
    case 'grew':
      return '↑'
    case 'shrank':
      return '↓'
    case 'new':
      return '✨'
    case 'gone':
      return '◌'
  }
}

function changeColor(c: CategoryChange): string {
  switch (c.kind) {
    case 'grew':
      return 'var(--destructive)'
    case 'shrank':
      return 'var(--primary)'
    case 'new':
      return 'var(--primary)'
    case 'gone':
      return 'var(--muted-foreground)'
  }
}

function describeChange(c: CategoryChange): string {
  if (c.kind === 'new') {
    return `${c.category}：新類別 ${currency(c.current)}`
  }
  if (c.kind === 'gone') {
    return `${c.category}：本月沒了（上月 ${currency(c.previous)}）`
  }
  const pctText =
    c.deltaPct !== null
      ? `${c.deltaPct > 0 ? '+' : ''}${Math.round(c.deltaPct * 100)}%`
      : ''
  return `${c.category} ${pctText}（${currency(c.previous)} → ${currency(c.current)}）`
}

/**
 * Category month-over-month diff (Issue #298). Surfaces the categories
 * that meaningfully shifted from last month, separately from total-amount
 * change. Filters trivial moves so the home page only renders shifts that
 * change behavior.
 */
export function CategoryMoM({ expenses, limit = 3 }: CategoryMoMProps) {
  const data = useMemo(
    () => analyzeCategoryMoM({ expenses }),
    [expenses],
  )

  if (!data || data.changes.length === 0) return null

  const top = data.changes.slice(0, limit)

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        🔄 類別月變化 · {data.previousMonthLabel} → {data.currentMonthLabel}
      </div>

      <ul className="space-y-2">
        {top.map((c) => (
          <li key={c.category} className="flex items-center gap-2 text-sm">
            <span
              className="font-bold text-base"
              style={{ color: changeColor(c) }}
              aria-hidden
            >
              {changeIcon(c)}
            </span>
            <span className="text-[var(--foreground)]">{describeChange(c)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

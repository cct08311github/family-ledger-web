'use client'

import { useMemo } from 'react'
import { buildExpenseContext } from '@/lib/expense-context'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface ExpenseContextStripProps {
  expense: Expense
  allExpenses: Expense[]
}

/**
 * Inline context for the expense detail / edit page (Issue #319). A
 * single-line bar that surfaces three small data points:
 *  - Where this expense ranks within its calendar month
 *  - How many times this exact description appeared in the last year
 *  - This-month accumulation in the same category
 *
 * Renders silently when nothing meaningful to say (e.g. month with only
 * this expense and no description matches and no other category items).
 */
export function ExpenseContextStrip({ expense, allExpenses }: ExpenseContextStripProps) {
  const data = useMemo(
    () => buildExpenseContext({ expense, allExpenses }),
    [expense, allExpenses],
  )

  if (!data) return null

  const facts: string[] = []

  // Month rank — only meaningful if there are >= 3 expenses in month
  if (data.monthCount >= 3) {
    facts.push(`本月第 ${data.monthRank} 大支出（共 ${data.monthCount} 筆）`)
  }

  // Same-description history
  if (data.sameDescriptionCount > 0) {
    const desc = (expense.description || '').trim() || '此 description'
    facts.push(
      `「${desc}」買過 ${data.sameDescriptionCount} 次（平均 ${currency(data.sameDescriptionAverage)}）`,
    )
  }

  // Same-category month accumulation
  if (data.sameCategoryMonthCount > 0) {
    const category = (expense.category || '其他').trim() || '其他'
    facts.push(
      `本月「${category}」累計 ${currency(data.sameCategoryMonthTotal)}（${data.sameCategoryMonthCount} 筆）`,
    )
  }

  if (facts.length === 0) return null

  return (
    <div
      className="rounded-md px-3 py-2 text-xs flex flex-wrap gap-x-3 gap-y-1 animate-fade-up"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--primary) 6%, transparent)',
        borderLeft: '2px solid var(--primary)',
      }}
      role="note"
    >
      <span aria-hidden className="text-[var(--muted-foreground)]">
        ★
      </span>
      {facts.map((fact, i) => (
        <span key={i} className="text-[var(--foreground)]">
          {fact}
        </span>
      ))}
    </div>
  )
}

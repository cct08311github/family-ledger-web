'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { topNExpenses } from '@/lib/top-expenses'
import { categoryColor } from '@/lib/category-color'
import { currency, fmtDate, toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface TopExpensesCardProps {
  expenses: Expense[]
  /** Optional groupId for deep-link query suffix; matches existing /expense/[id] href shape. */
  groupId?: string
  /** How many to show. Default 3. */
  count?: number
  /** Optional title override. */
  title?: string
}

/**
 * "Top N largest expenses" card for the /statistics page (Issue #278).
 * Hidden entirely when there are no expenses to show.
 */
export function TopExpensesCard({ expenses, groupId, count = 3, title }: TopExpensesCardProps) {
  const top = useMemo(() => topNExpenses(expenses, count), [expenses, count])

  if (top.length === 0) return null

  return (
    <div className="card p-5 md:p-6 space-y-3">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        {title ?? `💰 本月最大支出 (Top ${top.length})`}
      </div>
      <div className="space-y-1.5">
        {top.map((e, i) => {
          const color = categoryColor(e.category)
          const href = groupId
            ? `/expense/${e.id}?groupId=${groupId}`
            : `/expense/${e.id}`
          return (
            <Link
              key={e.id}
              href={href}
              className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
              title={`查看詳情：${e.description}`}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: color.bg, color: color.fg }}
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{e.description}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {e.category} · {fmtDate(toDate(e.date))} · {e.payerName}付
                </div>
              </div>
              <div className="font-semibold tabular-nums">{currency(e.amount)}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

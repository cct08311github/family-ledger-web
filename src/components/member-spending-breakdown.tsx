'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { aggregateMemberSpending } from '@/lib/member-spending'
import { categoryColor } from '@/lib/category-color'
import { currency } from '@/lib/utils'
import type { Expense, FamilyMember } from '@/lib/types'

interface MemberSpendingBreakdownProps {
  expenses: Expense[]
  members: FamilyMember[]
  /** ISO YYYY-MM-DD inclusive — used to build the drill-down URL. */
  monthStart: string
  monthEnd: string
}

/**
 * Per-member "paid as payer" breakdown bar chart on home (Issue #264).
 * Click a row → /records?payer=<id>&start=<>&end=<>.
 */
export function MemberSpendingBreakdown({
  expenses,
  members,
  monthStart,
  monthEnd,
}: MemberSpendingBreakdownProps) {
  const rows = useMemo(
    () => aggregateMemberSpending(expenses, members),
    [expenses, members],
  )

  // Hide entirely when no spending recorded — avoids blank zeros.
  const total = rows.reduce((s, r) => s + r.paid, 0)
  if (total === 0) return null

  return (
    <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        💸 本月成員花費分布
      </div>
      <div className="space-y-1">
        {rows.map((row) => {
          if (row.paid === 0) return null
          const color = categoryColor(row.memberName) // reuse stable hash palette
          const pct = Math.round(row.share * 100)
          const href = `/records?payer=${encodeURIComponent(row.memberId)}&start=${monthStart}&end=${monthEnd}`
          return (
            <Link
              key={row.memberId}
              href={href}
              title={`查看 ${row.memberName} 本月支出`}
              className="flex items-center gap-2 text-sm py-1.5 px-2 -mx-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={{ backgroundColor: color.bg, color: color.fg }}
                aria-hidden
              >
                {row.memberName.charAt(0)}
              </span>
              <span className="w-16 font-medium truncate">{row.memberName}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: color.fg, opacity: 0.6 }}
                />
              </div>
              <span className="w-12 text-right text-xs text-[var(--muted-foreground)]">
                {pct}%
              </span>
              <span className="w-24 text-right font-semibold tabular-nums">
                {currency(row.paid)}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

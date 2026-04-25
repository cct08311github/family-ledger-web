'use client'

import { useRouter } from 'next/navigation'
import { currency, toDate, fmtDate } from '@/lib/utils'
import { categoryColor } from '@/lib/category-color'
import { useGroup } from '@/lib/hooks/use-group'
import { useCurrentMember } from '@/lib/hooks/use-current-member'
import type { Expense } from '@/lib/types'

interface RecentExpensesListProps {
  expenses: Expense[]
}

/**
 * Home-page list of the user's most recent expenses. Extracted from the
 * previously inline JSX in the home page so it can be embedded inside the
 * RecentTimelineTabs card (Issue #222).
 */
export function RecentExpensesList({ expenses }: RecentExpensesListProps) {
  const router = useRouter()
  const { group } = useGroup()
  const { currentMemberId } = useCurrentMember(group?.id)

  if (expenses.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="text-3xl mb-2">📭</div>
        <p className="text-[var(--muted-foreground)] text-sm">還沒有任何記錄，點下方「記帳」開始！</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {expenses.map((e) => {
        const color = categoryColor(e.category)
        return (
        <div
          key={e.id}
          className="group flex items-center gap-3 py-2 rounded-lg hover:bg-[var(--muted)] px-2 -mx-2 transition-colors"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
            style={{ backgroundColor: color.bg, color: color.fg }}
            title={e.category}
          >
            {e.isShared ? '👥' : '👤'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{e.description}</div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {fmtDate(toDate(e.date))} · {e.category} ·{' '}
              {currentMemberId && e.payerId === currentMemberId ? (
                <span className="font-semibold text-[var(--foreground)]">我付</span>
              ) : (
                <>{e.payerName}付</>
              )}
            </div>
          </div>
          <div className="font-semibold text-sm">{currency(e.amount)}</div>
          <button
            onClick={() => router.push(`/expense/new?duplicate=${e.id}`)}
            title="複製此筆"
            aria-label="複製此筆"
            className="md:opacity-0 md:group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-opacity text-xs flex-shrink-0"
          >
            📋
          </button>
        </div>
        )
      })}
    </div>
  )
}

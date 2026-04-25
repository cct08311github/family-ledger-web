'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { detectSubscriptionCandidates } from '@/lib/subscription-detector'
import { currency } from '@/lib/utils'
import type { Expense, RecurringExpense } from '@/lib/types'

interface SubscriptionSuggestionsProps {
  expenses: Expense[]
  recurringTemplates: RecurringExpense[]
}

/**
 * Surfaces auto-detected subscription patterns from expense history (Issue #286).
 * Suggests turning recurring (description, amount) pairs into managed
 * RecurringExpense templates so they auto-generate going forward.
 *
 * Renders nothing when there are no candidates.
 */
export function SubscriptionSuggestions({ expenses, recurringTemplates }: SubscriptionSuggestionsProps) {
  const candidates = useMemo(
    () => detectSubscriptionCandidates({ expenses, recurringTemplates }),
    [expenses, recurringTemplates],
  )

  if (candidates.length === 0) return null

  // Cap to top 2 to avoid wall-of-suggestions
  const top = candidates.slice(0, 2)

  return (
    <div className="card p-4 space-y-2 animate-fade-up"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--primary), transparent 92%)',
      }}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        💡 偵測到隱藏訂閱
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        以下支出最近重複出現，可能是固定月費。設成定期支出後系統會自動幫你記。
      </p>
      <div className="space-y-1.5">
        {top.map((c) => (
          <div
            key={`${c.description}-${c.amount}`}
            className="flex items-center gap-2 text-sm bg-[var(--card)] rounded-lg p-2.5"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{c.description}</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {currency(c.amount)} ·{' '}
                {c.cadence === 'monthly'
                  ? `每月 (已記 ${c.occurrences} 次)`
                  : `每週 (已記 ${c.occurrences} 次)`}
              </div>
            </div>
            <Link
              href="/settings/recurring"
              className="text-xs px-3 py-1.5 rounded-lg btn-primary btn-press whitespace-nowrap"
              title="到定期支出設定頁建立"
            >
              建立
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

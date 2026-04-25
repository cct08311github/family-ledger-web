'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { suggestNextExpense } from '@/lib/smart-quick-add'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface SmartQuickAddSuggestionProps {
  expenses: Expense[]
}

/**
 * Predict the user's most-likely next expense based on day-of-week +
 * hour-of-day routine matching (Issue #334). Tap to open expense form
 * pre-filled with the suggested values. Stays silent unless there's a
 * confident pattern — better than a noisy guess.
 */
export function SmartQuickAddSuggestion({ expenses }: SmartQuickAddSuggestionProps) {
  const suggestion = useMemo(
    () => suggestNextExpense({ expenses }),
    [expenses],
  )

  if (!suggestion) return null

  const href = `/expense/new?duplicate=${suggestion.sourceId}`

  return (
    <Link
      href={href}
      className="block rounded-lg px-3 py-2 text-xs hover:opacity-80 transition animate-fade-up"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--primary) 8%, transparent)',
        borderLeft: '2px solid var(--primary)',
      }}
      role="link"
    >
      <span aria-hidden className="mr-1">
        💡
      </span>
      <span className="text-[var(--muted-foreground)]">建議：</span>
      <span className="font-semibold text-[var(--foreground)]">
        {suggestion.description}
      </span>{' '}
      <span className="text-[var(--foreground)]">
        {currency(suggestion.amount)}
      </span>
      <span className="text-[var(--muted-foreground)]">
        （{suggestion.category}．過去 {suggestion.basedOn} 次同時段都這樣）
      </span>
      <span className="ml-2 text-[var(--primary)] font-medium">→ 一鍵新增</span>
    </Link>
  )
}

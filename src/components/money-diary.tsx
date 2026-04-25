'use client'

import { useMemo } from 'react'
import { extractDiaryFacts, composeDiarySentences } from '@/lib/money-diary'
import type { Expense } from '@/lib/types'

interface MoneyDiaryProps {
  /** Expenses occurring within the selected month. */
  monthExpenses: Expense[]
  /** All expenses prior to selectedMonth — used to detect "first-time" categories. */
  earlierExpenses: Expense[]
  /** Total spending in the previous calendar month, or null when unavailable. */
  previousMonthTotal: number | null
  /** Selected month (year + 0-indexed month). */
  selectedMonth: { year: number; month: number }
}

/**
 * Renders a narrative diary of the month's spending (Issue #282). Designed
 * for end-of-month family conversations: reads like a journal entry, not a
 * dashboard. Returns null when there's nothing to say.
 */
export function MoneyDiary({
  monthExpenses,
  earlierExpenses,
  previousMonthTotal,
  selectedMonth,
}: MoneyDiaryProps) {
  const sentences = useMemo(() => {
    const facts = extractDiaryFacts({
      monthExpenses,
      earlierExpenses,
      previousMonthTotal,
    })
    return composeDiarySentences(facts, selectedMonth)
  }, [monthExpenses, earlierExpenses, previousMonthTotal, selectedMonth])

  if (sentences.length === 0) return null

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        📖 {selectedMonth.year}/{String(selectedMonth.month + 1).padStart(2, '0')} 月度記事
      </div>
      <div className="space-y-2">
        {sentences.map((s, i) => (
          <p
            key={i}
            className="text-sm leading-relaxed text-[var(--foreground)]"
            // First sentence stands out a touch
            style={i === 0 ? { fontWeight: 500 } : undefined}
          >
            {s}
          </p>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { findSameDescriptionHistory } from '@/lib/same-description-history'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface DescriptionPriceHistoryProps {
  description: string
  expenses: Expense[]
  /** ID of the expense being edited (excluded from history). */
  currentExpenseId?: string
  /** Debounce ms before query fires. Default 200. */
  debounceMs?: number
}

/**
 * Inline same-description price history for the expense form (Issue #307).
 * Surfaces the user's last few payments for an identical description so
 * they can sense-check the amount they're about to enter — distinct from
 * duplicate-detector which warns about *very recent* near-identical
 * records (an anti-double-record defence).
 */
export function DescriptionPriceHistory({
  description,
  expenses,
  currentExpenseId,
  debounceMs = 200,
}: DescriptionPriceHistoryProps) {
  const [debouncedDescription, setDebouncedDescription] = useState(description)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedDescription(description), debounceMs)
    return () => clearTimeout(t)
  }, [description, debounceMs])

  const data = useMemo(
    () =>
      findSameDescriptionHistory({
        description: debouncedDescription,
        expenses,
        currentId: currentExpenseId,
      }),
    [debouncedDescription, expenses, currentExpenseId],
  )

  if (!data) return null

  const sinceLastLabel =
    data.daysSinceLast === 0
      ? '今天'
      : data.daysSinceLast === 1
        ? '昨天'
        : `${data.daysSinceLast} 天前`

  return (
    <div
      className="mt-1.5 px-3 py-2 rounded-md text-xs animate-fade-up"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--primary) 8%, transparent)',
        borderLeft: '2px solid var(--primary)',
      }}
      role="note"
      aria-live="polite"
    >
      <p className="text-[var(--foreground)]">
        上次 <span className="font-semibold">{currency(data.lastEntry.amount)}</span>
        <span className="text-[var(--muted-foreground)]"> · {sinceLastLabel}</span>
      </p>
      {data.count >= 2 && (
        <p className="text-[var(--muted-foreground)] mt-0.5">
          共 {data.count} 次 · 平均 {currency(data.averagePrice)}
        </p>
      )}
    </div>
  )
}

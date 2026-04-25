'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { analyzeMostFrequent } from '@/lib/most-frequent-items'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface MostFrequentItemsProps {
  expenses: Expense[]
  /** Days back from today. Default 90. */
  days?: number
  /** Top N to render. Default 5. */
  limit?: number
}

/**
 * Most-frequent purchases over a rolling window (Issue #301). The top
 * description axis — complementary to the amount/category/time axes used
 * by every other home widget. Each row links to the records page filtered
 * by description, so users can drill into the price history.
 */
export function MostFrequentItems({
  expenses,
  days = 90,
  limit = 5,
}: MostFrequentItemsProps) {
  const items = useMemo(
    () => analyzeMostFrequent({ expenses, days, limit }),
    [expenses, days, limit],
  )

  if (items.length === 0) return null

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        🔁 你最常買 · 近 {days} 天
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {items.map((item, i) => (
          <li key={item.description}>
            <Link
              href={`/records?q=${encodeURIComponent(item.description)}`}
              className="flex items-center justify-between gap-3 py-2 hover:bg-[var(--muted)] transition rounded px-2 -mx-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono text-[var(--muted-foreground)] w-4 text-right">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-[var(--foreground)] truncate">
                  {item.description}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] flex-shrink-0">
                <span>{item.count} 次</span>
                <span className="font-medium text-[var(--foreground)]">
                  平均 {currency(item.averagePrice)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

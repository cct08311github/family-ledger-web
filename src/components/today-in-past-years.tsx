'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { findTodayInPastYears, type PastYearMemory } from '@/lib/today-in-past-years'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface TodayInPastYearsProps {
  expenses: Expense[]
  /** Years back to look. Default 3. */
  maxYears?: number
}

function yearsAgoLabel(n: number): string {
  return `${n} 年前`
}

function MemoryRow({ memory }: { memory: PastYearMemory }) {
  return (
    <div className="space-y-0.5">
      <p className="text-sm">
        <span className="font-semibold text-[var(--foreground)]">
          {yearsAgoLabel(memory.yearsAgo)}
        </span>
        <span className="text-[var(--muted-foreground)]"> ({memory.date})</span>
      </p>
      <p className="text-xs text-[var(--muted-foreground)]">
        共 {memory.count} 筆 · 總計{' '}
        <span className="text-[var(--foreground)]">{currency(memory.total)}</span>
        {memory.biggest && memory.count >= 2 && (
          <>
            {' · 最大：'}
            <span className="text-[var(--foreground)]">{memory.biggest.description}</span>{' '}
            {currency(memory.biggest.amount)}
          </>
        )}
        {memory.biggest && memory.count === 1 && (
          <>
            {' · '}
            <span className="text-[var(--foreground)]">{memory.biggest.description}</span>
          </>
        )}
      </p>
    </div>
  )
}

/**
 * Facebook-Memories-style time-travel widget (Issue #315). Surfaces what
 * the family spent on this exact date 1, 2, 3 years ago. Renders silently
 * for new users — only adds value when there's enough history. Each
 * memory links to /records filtered to that date.
 */
export function TodayInPastYears({ expenses, maxYears = 3 }: TodayInPastYearsProps) {
  const memories = useMemo(
    () => findTodayInPastYears({ expenses, maxYears }),
    [expenses, maxYears],
  )

  if (memories.length === 0) return null

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        📔 X 年前的今天
      </div>
      <ul className="space-y-3 divide-y divide-[var(--border)]">
        {memories.map((m) => (
          <li key={m.yearsAgo} className="pt-3 first:pt-0">
            <Link
              href={`/records?start=${m.date}&end=${m.date}`}
              className="block hover:bg-[var(--muted)] transition rounded -mx-2 px-2 py-1"
            >
              <MemoryRow memory={m} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

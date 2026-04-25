import { getNextOccurrences } from './recurring-occurrences'
import { toDate } from './utils'
import type { RecurringExpense } from './types'

export interface LockedInItem {
  templateId: string
  description: string
  /** May be null when template has variable amount — caller chooses to render. */
  amount: number | null
  category: string
  /** YYYY-MM-DD (local). */
  expectedDate: string
}

export interface NextMonthLockedInData {
  /** "YYYY-MM" of the upcoming calendar month. */
  monthLabel: string
  /** Number of fixed-amount occurrences. */
  count: number
  /** Number of variable-amount occurrences (excluded from totalEstimated). */
  variableCount: number
  /** Sum of all fixed-amount occurrences. Null when only variable items. */
  totalEstimated: number | null
  /** All occurrences (fixed + variable), chronological. */
  items: LockedInItem[]
}

interface ForecastOptions {
  recurringTemplates: RecurringExpense[]
  now?: number
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Project all active recurring templates' occurrences into the upcoming
 * calendar month. Returns null when no occurrences fall in next month
 * (no active templates or all paused / end-dated past it).
 *
 * Different from MonthProjection (#296) which extrapolates current
 * month's pace — this one is grounded in already-committed fixed
 * expenses, so it's a *floor* not an estimate.
 */
export function forecastNextMonthLockedIn({
  recurringTemplates,
  now = Date.now(),
}: ForecastOptions): NextMonthLockedInData | null {
  const today = new Date(now)
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const monthAfterNext = new Date(today.getFullYear(), today.getMonth() + 2, 1)
  const after = new Date(nextMonth.getTime() - 1) // exclusive-left for getNextOccurrences
  const before = new Date(monthAfterNext.getTime() - 1) // last ms of next month

  const monthLabel = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`

  const items: LockedInItem[] = []
  let totalFixed = 0
  let fixedCount = 0
  let variableCount = 0

  for (const t of recurringTemplates) {
    if (t.isPaused) continue
    // endDate cutoff: skip if endDate is before next month starts
    if (t.endDate) {
      try {
        const end = toDate(t.endDate)
        if (Number.isFinite(end.getTime()) && end.getTime() < nextMonth.getTime()) {
          continue
        }
      } catch {
        // bad endDate — treat as ongoing, fall through
      }
    }

    let occurrences: Date[]
    try {
      occurrences = getNextOccurrences(t, after, before)
    } catch {
      continue
    }

    for (const occ of occurrences) {
      items.push({
        templateId: t.id,
        description: (t.description || '(無描述)').trim() || '(無描述)',
        amount: typeof t.amount === 'number' && Number.isFinite(t.amount) && t.amount > 0
          ? t.amount
          : null,
        category: (t.category || '其他').trim() || '其他',
        expectedDate: dateKey(occ),
      })
      if (typeof t.amount === 'number' && Number.isFinite(t.amount) && t.amount > 0) {
        totalFixed += t.amount
        fixedCount++
      } else {
        variableCount++
      }
    }
  }

  if (items.length === 0) return null

  items.sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : a.expectedDate > b.expectedDate ? 1 : 0))

  return {
    monthLabel,
    count: fixedCount,
    variableCount,
    totalEstimated: fixedCount > 0 ? totalFixed : null,
    items,
  }
}

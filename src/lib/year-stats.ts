/**
 * Year-to-date stats for the /statistics summary card (Issue #276).
 *
 * Pure function — caller passes already-filtered visible expenses (the
 * useExpenses hook already applies the personal/shared visibility rule).
 * `now` is injectable so tests stay deterministic.
 */
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

export interface YearStats {
  year: number
  /** Sum of expense.amount for the given year up to and including `now`. */
  total: number
  /** Number of months elapsed (1..12) — current month counts as elapsed. */
  monthsElapsed: number
  /** total / monthsElapsed, rounded to int. */
  averagePerMonth: number
}

export function aggregateYearStats(
  expenses: readonly Expense[],
  year: number,
  now: Date,
): YearStats {
  let total = 0
  for (const e of expenses) {
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount)) continue
    let d: Date
    try {
      d = toDate(e.date)
    } catch {
      // Malformed date (e.g. string instead of Timestamp/Date) — skip the record
      continue
    }
    if (!Number.isFinite(d.getTime())) continue
    if (d.getFullYear() !== year) continue
    total += e.amount
  }

  // monthsElapsed:
  // - For the current year: 1..12 based on now.getMonth()
  // - For a past year: full 12
  // - For a future year: 0 (no average computed)
  let monthsElapsed: number
  if (year > now.getFullYear()) {
    monthsElapsed = 0
  } else if (year < now.getFullYear()) {
    monthsElapsed = 12
  } else {
    monthsElapsed = now.getMonth() + 1
  }

  const averagePerMonth =
    monthsElapsed > 0 ? Math.round(total / monthsElapsed) : 0

  return { year, total, monthsElapsed, averagePerMonth }
}

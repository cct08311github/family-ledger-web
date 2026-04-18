/**
 * Pure budget math helpers for the monthly budget progress display.
 * Extracted so the component renders from stable inputs and the
 * boundary/threshold math has unit test coverage. Issue #189.
 */

import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

/** First local-midnight instant of `now`'s month. */
export function getMonthStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/** Number of days in `now`'s month (handles leap year, 30/31). */
export function getDaysInMonth(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

/**
 * Sum expenses whose date is on or after `since`. Accepts the full expense list
 * and filters internally so the caller doesn't have to remember the `toDate`
 * conversion (expense dates are Firestore Timestamps, not JS Date).
 */
export function calculateMonthTotal(expenses: readonly Expense[], since: Date): number {
  let total = 0
  for (const e of expenses) {
    if (toDate(e.date) >= since) total += e.amount
  }
  return total
}

export type BudgetStatusKind = 'ok' | 'overPace' | 'overBudget'

export interface BudgetStatus {
  /** Clamped 0..N; no cap on over-budget so "125%" still renders correctly. */
  percentUsed: number
  /** Linear-pace expected spend at today's day-of-month. */
  expectedByNow: number
  kind: BudgetStatusKind
  /** True when `spent > budget`. */
  overBudget: boolean
  /** True when `spent > expectedByNow` (includes overBudget). */
  overPace: boolean
  /**
   * Localized status phrase:
   *   - overBudget → `超支 NT$N`
   *   - overPace (but under budget) → `超速 NT$N`
   *   - ok → `領先 NT$N`
   */
  statusText: string
}

/**
 * Classify current spending against the monthly budget at a given pace point.
 * Assumes `budget > 0`. Caller must gate on `budget != null` before calling.
 */
export function classifyBudgetStatus(args: {
  budget: number
  spent: number
  dayOfMonth: number
  daysInMonth: number
  /** Optional currency formatter; defaults to a simple `NT$` formatter so the
   * helper stays pure (no import of the app-wide currency helper). Pass the app
   * `currency` function for real UI calls. */
  formatCurrency?: (_n: number) => string
}): BudgetStatus {
  const { budget, spent, dayOfMonth, daysInMonth } = args
  const fmt = args.formatCurrency ?? ((n) => `NT$${n.toLocaleString()}`)

  // Guard pathological inputs instead of dividing by zero.
  const safeDaysInMonth = daysInMonth > 0 ? daysInMonth : 30
  const safeBudget = budget > 0 ? budget : 0

  const expectedByNow = safeBudget > 0 ? (safeBudget * dayOfMonth) / safeDaysInMonth : 0
  const percentUsed = safeBudget > 0 ? Math.round((spent / safeBudget) * 100) : 0
  const overBudget = safeBudget > 0 && spent > safeBudget
  const overPace = safeBudget > 0 && spent > expectedByNow

  let kind: BudgetStatusKind
  let statusText: string
  if (overBudget) {
    kind = 'overBudget'
    statusText = `超支 ${fmt(Math.round(spent - safeBudget))}`
  } else if (overPace) {
    kind = 'overPace'
    statusText = `超速 ${fmt(Math.round(spent - expectedByNow))}`
  } else {
    kind = 'ok'
    statusText = `領先 ${fmt(Math.round(expectedByNow - spent))}`
  }

  return { percentUsed, expectedByNow, kind, overBudget, overPace, statusText }
}

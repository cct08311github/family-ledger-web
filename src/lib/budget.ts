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
  /**
   * Spent / budget × 100, rounded. Not clamped — values above 100 are valid
   * and displayed as e.g. "125%". UI may choose to cap the visual bar width
   * at 100% separately.
   */
  percentUsed: number
  /** Linear-pace expected spend at today's day-of-month. */
  expectedByNow: number
  kind: BudgetStatusKind
  /** True when `spent > budget` (strict). Equal is NOT over-budget. */
  overBudget: boolean
  /**
   * True when `spent > expectedByNow` (strict). Equal is NOT over-pace.
   * Note: `overBudget === true` always implies `overPace === true` (exceeding
   * the full budget necessarily exceeds the linear-pace point).
   */
  overPace: boolean
  /**
   * Localized status phrase using the provided currency formatter:
   *   - overBudget → `超支 ${fmt(N)}`
   *   - overPace (but under budget) → `超速 ${fmt(N)}`
   *   - ok → `領先 ${fmt(N)}`
   */
  statusText: string
  /**
   * Linear extrapolation of month-end total: `spent / dayOfMonth × daysInMonth`.
   * Early in the month the estimate is volatile (one big expense on day 1
   * implies a 30× month) — callers should show a "stabilising" hint for small
   * dayOfMonth. Issue #203.
   */
  projected: number
  /**
   * `projected / budget × 100`, rounded. Returns 0 when budget ≤ 0 so the UI
   * can unconditionally read the field without a NaN guard.
   */
  projectedPercent: number
  /**
   * True when `projected > budget` (strict).
   * Note on implication relationships (mathematically equivalent when
   * `dayOfMonth > 0` and `daysInMonth > 0`):
   *   spent > budget×day/daysInMonth
   *     ⇔ (spent/day)×daysInMonth > budget
   *     ⇔ projected > budget
   * So `overPace` and `projectedOverBudget` coincide at the same threshold
   * — they are TWO LABELS for the same inequality. Kept as two fields because
   * the UI renders them differently (badge vs. projection line).
   * `overBudget` is the stricter case `spent > budget` and implies both.
   */
  projectedOverBudget: boolean
}

/** Default formatter matches app-wide `currency()` format (`NT$ 1,234`). */
const DEFAULT_CURRENCY_FORMAT = (n: number): string => `NT$ ${n.toLocaleString()}`

/**
 * Classify current spending against the monthly budget at a given pace point.
 * Caller should pre-check `budget != null`; `budget <= 0` returns an all-zero
 * "ok" status (no division by zero). `daysInMonth <= 0` falls back to 30 to
 * avoid division by zero on pathological inputs.
 */
export function classifyBudgetStatus(args: {
  budget: number
  spent: number
  dayOfMonth: number
  daysInMonth: number
  /**
   * Optional currency formatter. Defaults to `NT$ 1,234` to stay consistent
   * with the app-wide `currency()` helper in `@/lib/utils`. Kept as injection
   * to avoid this module depending on app-layer code.
   */
  formatCurrency?: (_n: number) => string
}): BudgetStatus {
  const { budget, spent, dayOfMonth, daysInMonth } = args
  const fmt = args.formatCurrency ?? DEFAULT_CURRENCY_FORMAT

  // Defensive: daysInMonth = 0 shouldn't happen from real Date usage but guard
  // against it to keep the helper total-function.
  const safeDaysInMonth = daysInMonth > 0 ? daysInMonth : 30

  // dayOfMonth = 0 is pathological (Date.getDate() is 1-31), but fall back to
  // 1 to keep the helper total-function rather than NaN-propagating.
  const safeDayOfMonth = dayOfMonth > 0 ? dayOfMonth : 1
  // Round once here so `projectedPercent` derives from the same integer that
  // the UI will display (prevents display-vs-percent off-by-one drift).
  const projected = Math.round((spent / safeDayOfMonth) * safeDaysInMonth)

  if (budget <= 0) {
    return {
      percentUsed: 0,
      expectedByNow: 0,
      kind: 'ok',
      overBudget: false,
      overPace: false,
      statusText: `領先 ${fmt(0)}`,
      projected,
      projectedPercent: 0,
      projectedOverBudget: false,
    }
  }

  const expectedByNow = (budget * dayOfMonth) / safeDaysInMonth
  const percentUsed = Math.round((spent / budget) * 100)
  const overBudget = spent > budget
  const overPace = spent > expectedByNow
  const projectedPercent = Math.round((projected / budget) * 100)
  const projectedOverBudget = projected > budget

  let kind: BudgetStatusKind
  let statusText: string
  if (overBudget) {
    kind = 'overBudget'
    statusText = `超支 ${fmt(Math.round(spent - budget))}`
  } else if (overPace) {
    kind = 'overPace'
    statusText = `超速 ${fmt(Math.round(spent - expectedByNow))}`
  } else {
    kind = 'ok'
    statusText = `領先 ${fmt(Math.round(expectedByNow - spent))}`
  }

  return {
    percentUsed,
    expectedByNow,
    kind,
    overBudget,
    overPace,
    statusText,
    projected,
    projectedPercent,
    projectedOverBudget,
  }
}

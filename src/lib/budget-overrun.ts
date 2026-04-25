import { forecastCurrentMonth } from './month-projection'
import type { Expense } from './types'

export type OverrunSeverity = 'warning' | 'critical'

export interface BudgetOverrunData {
  /** Linear projection of month-end total spending. */
  projectedTotal: number
  /** Monthly budget target. */
  budget: number
  /** Total amount projected over budget (always > 0 when this returns non-null). */
  overrun: number
  /** overrun / budget (0..1+). */
  overrunPct: number
  /** Calendar-day pace so far (spentSoFar / daysSoFar). */
  currentDailyPace: number
  /** What the user would need to limit per remaining day to hit budget. Negative = impossible. */
  requiredDailyToHitBudget: number
  /** Days left in the current calendar month, ≥ 0. */
  daysRemaining: number
  /** spent so far. */
  spentSoFar: number
  severity: OverrunSeverity
}

interface CheckOptions {
  expenses: Expense[]
  /** Active monthly budget. Returns null if not provided / non-positive. */
  monthlyBudget: number | null | undefined
  now?: number
  /** Buffer before triggering — projection must exceed budget × this to fire. Default 1.05 (5%). */
  triggerThreshold?: number
  /** Critical threshold for severity escalation. Default 1.20 (20%). */
  criticalThreshold?: number
}

/**
 * Predictive budget warning. Returns non-null only when the linear pace
 * projection comfortably exceeds the budget — uses a 5% buffer by default
 * to absorb noise from early-month days. Distinct from BudgetProgress
 * (passive snapshot) and MonthProjection (always-on forecast): this one
 * is action-triggering — a banner that appears only when the user can
 * still change course.
 */
export function checkBudgetOverrun({
  expenses,
  monthlyBudget,
  now = Date.now(),
  triggerThreshold = 1.05,
  criticalThreshold = 1.2,
}: CheckOptions): BudgetOverrunData | null {
  if (
    typeof monthlyBudget !== 'number' ||
    !Number.isFinite(monthlyBudget) ||
    monthlyBudget <= 0
  ) {
    return null
  }

  const projection = forecastCurrentMonth({ expenses, now })
  if (!projection) return null

  const { projectedTotal, spentSoFar, daysSoFar, daysInMonth } = projection
  if (projectedTotal <= monthlyBudget * triggerThreshold) return null

  const overrun = projectedTotal - monthlyBudget
  const overrunPct = overrun / monthlyBudget
  const daysRemaining = Math.max(0, daysInMonth - daysSoFar)
  const remainingBudget = monthlyBudget - spentSoFar
  const requiredDailyToHitBudget =
    daysRemaining > 0 ? remainingBudget / daysRemaining : remainingBudget
  const currentDailyPace = spentSoFar / daysSoFar
  const severity: OverrunSeverity =
    projectedTotal >= monthlyBudget * criticalThreshold ? 'critical' : 'warning'

  return {
    projectedTotal,
    budget: monthlyBudget,
    overrun,
    overrunPct,
    currentDailyPace,
    requiredDailyToHitBudget,
    daysRemaining,
    spentSoFar,
    severity,
  }
}

import { toDate } from './utils'
import type { Expense } from './types'

export type WowSeverity = 'mild' | 'sharp'

export interface WowAccelerationData {
  /** Sum of current week so far. */
  currentWeekTotal: number
  /** Sum of previous full week (Mon-Sun). */
  previousWeekTotal: number
  /** Days into current week (1..7). */
  daysIntoWeek: number
  /** Linear extrapolation: currentWeekTotal × 7 / daysIntoWeek. */
  estimatedFullWeek: number
  /** estimatedFullWeek - previousWeekTotal. */
  delta: number
  /** delta / previousWeekTotal. */
  deltaPct: number
  /** 'mild' for ≥1.5×, 'sharp' for ≥2×. */
  severity: WowSeverity
}

interface CheckOptions {
  expenses: Expense[]
  now?: number
  /** Min days into current week before checking. Default 2. */
  minDaysIntoWeek?: number
  /** Trigger threshold (estimated full-week / previous). Default 1.5. */
  triggerThreshold?: number
  /** Sharp threshold. Default 2.0. */
  sharpThreshold?: number
}

/**
 * Returns the start-of-day Date for the Monday of the calendar week
 * containing `d` (Mon..Sun convention, so Sunday belongs to the previous week).
 */
function mondayOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = x.getDay() // Sun=0..Sat=6
  const daysSinceMonday = dow === 0 ? 6 : dow - 1
  x.setDate(x.getDate() - daysSinceMonday)
  return x
}

/**
 * Short-horizon acceleration warning. Triggers when this-week's
 * extrapolated total exceeds last week's by ≥1.5×. Acts as an early
 * version of BudgetOverrunAlert (#321) — if the user is accelerating,
 * they'll usually overshoot the budget in 1-2 weeks.
 */
export function checkWowAcceleration({
  expenses,
  now = Date.now(),
  minDaysIntoWeek = 2,
  triggerThreshold = 1.5,
  sharpThreshold = 2.0,
}: CheckOptions): WowAccelerationData | null {
  const today = new Date(now)
  const thisMonday = mondayOf(today)
  const prevMonday = new Date(thisMonday)
  prevMonday.setDate(prevMonday.getDate() - 7)
  const prevSunday = new Date(thisMonday.getTime() - 1)

  const daysIntoWeek = Math.floor(
    (today.getTime() - thisMonday.getTime()) / 86_400_000,
  ) + 1

  if (daysIntoWeek < minDaysIntoWeek) return null

  let currentWeekTotal = 0
  let previousWeekTotal = 0

  for (const e of expenses) {
    const amount = Number(e.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    let d: Date
    try {
      d = toDate(e.date)
    } catch {
      continue
    }
    const ts = d.getTime()
    if (!Number.isFinite(ts)) continue
    if (ts >= thisMonday.getTime() && ts <= now) {
      currentWeekTotal += amount
    } else if (ts >= prevMonday.getTime() && ts <= prevSunday.getTime()) {
      previousWeekTotal += amount
    }
  }

  if (previousWeekTotal <= 0) return null
  if (currentWeekTotal <= 0) return null

  const estimatedFullWeek = (currentWeekTotal / daysIntoWeek) * 7
  const ratio = estimatedFullWeek / previousWeekTotal
  if (ratio < triggerThreshold) return null

  const severity: WowSeverity = ratio >= sharpThreshold ? 'sharp' : 'mild'
  const delta = estimatedFullWeek - previousWeekTotal
  const deltaPct = delta / previousWeekTotal

  return {
    currentWeekTotal,
    previousWeekTotal,
    daysIntoWeek,
    estimatedFullWeek,
    delta,
    deltaPct,
    severity,
  }
}

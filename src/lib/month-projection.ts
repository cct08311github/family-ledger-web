import { toDate } from './utils'
import type { Expense } from './types'

export interface MonthProjectionData {
  /** Year of the projected month. */
  year: number
  /** 0-indexed month. */
  month: number
  /** Days elapsed in current month (1..daysInMonth). */
  daysSoFar: number
  /** Total days in current month. */
  daysInMonth: number
  /** Sum of expense.amount for current month so far. */
  spentSoFar: number
  /** Projected total = spentSoFar / daysSoFar * daysInMonth. */
  projectedTotal: number
  /** Mean of complete prior months (up to 3 most recent). null if no history. */
  historicalAverage: number | null
  /** How many months were used in the historical average (0..3). */
  monthsAveraged: number
  /** projectedTotal - historicalAverage; null when historicalAverage is null. */
  vsHistorical: number | null
  /** Fractional progress through the month (daysSoFar / daysInMonth). */
  monthProgress: number
}

interface ForecastOptions {
  expenses: Expense[]
  /** Now in epoch ms; defaults to Date.now(). */
  now?: number
  /**
   * Minimum days into the month before producing a projection.
   * Defaults to 3 — earlier than that, the linear extrapolation is too noisy.
   */
  minDays?: number
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * Linear pace projection for the current month plus a comparison against
 * the trailing 3 *complete* months. Returns null when input is too thin to
 * say anything useful (start of month, or no spending yet).
 */
export function forecastCurrentMonth({
  expenses,
  now = Date.now(),
  minDays = 3,
}: ForecastOptions): MonthProjectionData | null {
  const today = new Date(now)
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysSoFar = today.getDate()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  if (daysSoFar < minDays) return null

  const monthTotals = new Map<string, number>()

  for (const e of expenses) {
    const amount = Number(e.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    let d: Date
    try {
      d = toDate(e.date)
    } catch {
      continue
    }
    if (!Number.isFinite(d.getTime())) continue
    const key = monthKey(d.getFullYear(), d.getMonth())
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + amount)
  }

  const currentKey = monthKey(year, month)
  const spentSoFar = monthTotals.get(currentKey) ?? 0

  if (spentSoFar <= 0) return null

  const projectedTotal = (spentSoFar / daysSoFar) * daysInMonth

  const priorKeys: string[] = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date(year, month - i, 1)
    priorKeys.push(monthKey(d.getFullYear(), d.getMonth()))
  }
  const priorTotals = priorKeys
    .map((k) => monthTotals.get(k) ?? 0)
    .filter((t) => t > 0)

  const monthsAveraged = priorTotals.length
  const historicalAverage =
    monthsAveraged > 0
      ? priorTotals.reduce((s, x) => s + x, 0) / monthsAveraged
      : null
  const vsHistorical =
    historicalAverage !== null ? projectedTotal - historicalAverage : null

  return {
    year,
    month,
    daysSoFar,
    daysInMonth,
    spentSoFar,
    projectedTotal,
    historicalAverage,
    monthsAveraged,
    vsHistorical,
    monthProgress: daysSoFar / daysInMonth,
  }
}

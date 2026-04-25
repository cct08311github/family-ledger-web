import { toDate } from './utils'
import type { Expense } from './types'

export interface CumulativePoint {
  day: number
  cumulative: number
}

export interface CumulativeCurveData {
  /** YYYY-MM label of current month. */
  monthLabel: string
  /** YYYY-MM label of previous month. */
  previousMonthLabel: string
  /** Current month points day=1..today (inclusive). */
  current: CumulativePoint[]
  /** Previous month points day=1..N (full month, if any data). null when no data. */
  previous: CumulativePoint[] | null
  /** Days in current calendar month (28..31). */
  daysInMonth: number
  /** Today's day-of-month (1..daysInMonth). */
  todayDay: number
  /** Cumulative spending up to and including today. */
  todayCumulative: number
  /** Cumulative spending in previous month at same day-of-month, capped at last day. null when no prev data. */
  prevSameDayCumulative: number | null
}

interface BuildOptions {
  expenses: Expense[]
  year: number
  /** 0-indexed month. */
  month: number
  now?: number
  /** Min days into month before producing data. Default 3. */
  minDays?: number
}

function dayOfMonth(d: Date): number {
  return d.getDate()
}

function buildCumulativeForMonth(
  expenses: Expense[],
  year: number,
  month: number,
  endDay: number,
): { points: CumulativePoint[]; total: number } {
  const dailyTotals = new Map<number, number>()

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
    if (d.getFullYear() !== year || d.getMonth() !== month) continue
    const day = dayOfMonth(d)
    if (day < 1 || day > endDay) continue
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + amount)
  }

  const points: CumulativePoint[] = []
  let cumulative = 0
  for (let day = 1; day <= endDay; day++) {
    cumulative += dailyTotals.get(day) ?? 0
    points.push({ day, cumulative })
  }
  return { points, total: cumulative }
}

/**
 * Cumulative day-by-day spending curve for a calendar month, paired with
 * the previous month's curve for pace comparison. The dual-line view
 * answers "am I ahead or behind last month's pace today?" in a single
 * glance.
 *
 * Returns null when current month is too young (< minDays) or has no
 * spending — neither case has a meaningful curve to draw.
 */
export function buildCumulativeMonthCurve({
  expenses,
  year,
  month,
  now = Date.now(),
  minDays = 3,
}: BuildOptions): CumulativeCurveData | null {
  const today = new Date(now)
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // todayDay caps at daysInMonth — handles future-month query (don't render)
  // and past-month query (render full month).
  let todayDay: number
  if (isCurrentMonth) {
    todayDay = today.getDate()
  } else if (
    today.getFullYear() > year ||
    (today.getFullYear() === year && today.getMonth() > month)
  ) {
    todayDay = daysInMonth
  } else {
    return null // future month
  }

  if (todayDay < minDays) return null

  const { points: current, total: currentTotal } = buildCumulativeForMonth(
    expenses,
    year,
    month,
    todayDay,
  )
  if (currentTotal <= 0) return null

  const prevYear = month === 0 ? year - 1 : year
  const prevMonth = month === 0 ? 11 : month - 1
  const prevDaysInMonth = new Date(prevYear, prevMonth + 1, 0).getDate()
  const prevResult = buildCumulativeForMonth(expenses, prevYear, prevMonth, prevDaysInMonth)
  const previous = prevResult.total > 0 ? prevResult.points : null

  // Day-of-month alignment for prevSameDay: cap to prev month's last day
  const cappedPrevDay = Math.min(todayDay, prevDaysInMonth)
  const prevSameDayCumulative =
    previous?.[cappedPrevDay - 1]?.cumulative ?? null

  return {
    monthLabel: `${year}-${String(month + 1).padStart(2, '0')}`,
    previousMonthLabel: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`,
    current,
    previous,
    daysInMonth,
    todayDay,
    todayCumulative: currentTotal,
    prevSameDayCumulative,
  }
}

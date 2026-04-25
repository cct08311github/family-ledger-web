import { toDate } from './utils'
import type { Expense } from './types'

export interface CategoryShift {
  category: string
  current: number
  previous: number
  delta: number
  deltaPct: number | null
}

export interface SameMonthLastYearData {
  /** "YYYY-MM" of current month. */
  monthLabel: string
  /** "YYYY-MM" of same month last year. */
  lastYearLabel: string
  current: {
    total: number
    count: number
  }
  lastYear: {
    total: number
    count: number
  }
  delta: number
  /** delta / lastYear.total. null when lastYear.total is 0. */
  deltaPct: number | null
  /** Up to 3 categories with biggest absolute change, sorted by |delta| desc. */
  topCategoryShift: CategoryShift[]
}

interface CompareOptions {
  expenses: Expense[]
  now?: number
  /** Min days into current month before producing comparison. Default 7. */
  minDaysSoFar?: number
  /** Min |delta| (NT$) for category to qualify as significant shift. Default 500. */
  minCategoryDelta?: number
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * Year-over-year same-month comparison. Surfaces seasonal patterns that
 * MoM misses (winter vs winter, holiday season, summer break) — useful
 * for asking "is this April normal for us?"
 *
 * Returns null when current month is too young, has no spending, or
 * matching last-year month has no data — in those cases the comparison
 * isn't meaningful.
 */
export function compareSameMonthLastYear({
  expenses,
  now = Date.now(),
  minDaysSoFar = 7,
  minCategoryDelta = 500,
}: CompareOptions): SameMonthLastYearData | null {
  const today = new Date(now)
  if (today.getDate() < minDaysSoFar) return null

  const year = today.getFullYear()
  const month = today.getMonth()
  const lastYear = year - 1

  let currentTotal = 0
  let currentCount = 0
  let lastYearTotal = 0
  let lastYearCount = 0
  const currentByCategory = new Map<string, number>()
  const lastYearByCategory = new Map<string, number>()

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

    const category = (e.category || '其他').trim() || '其他'

    if (d.getFullYear() === year && d.getMonth() === month && d.getTime() <= now) {
      currentTotal += amount
      currentCount++
      currentByCategory.set(category, (currentByCategory.get(category) ?? 0) + amount)
    } else if (d.getFullYear() === lastYear && d.getMonth() === month) {
      lastYearTotal += amount
      lastYearCount++
      lastYearByCategory.set(category, (lastYearByCategory.get(category) ?? 0) + amount)
    }
  }

  if (currentTotal <= 0) return null
  if (lastYearTotal <= 0) return null

  const delta = currentTotal - lastYearTotal
  const deltaPct = lastYearTotal > 0 ? delta / lastYearTotal : null

  const allCategories = new Set<string>([
    ...currentByCategory.keys(),
    ...lastYearByCategory.keys(),
  ])
  const shifts: CategoryShift[] = []
  for (const category of allCategories) {
    const current = currentByCategory.get(category) ?? 0
    const previous = lastYearByCategory.get(category) ?? 0
    const cDelta = current - previous
    if (Math.abs(cDelta) < minCategoryDelta) continue
    const cDeltaPct = previous > 0 ? cDelta / previous : null
    shifts.push({ category, current, previous, delta: cDelta, deltaPct: cDeltaPct })
  }
  shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return {
    monthLabel: monthKey(year, month),
    lastYearLabel: monthKey(lastYear, month),
    current: { total: currentTotal, count: currentCount },
    lastYear: { total: lastYearTotal, count: lastYearCount },
    delta,
    deltaPct,
    topCategoryShift: shifts.slice(0, 3),
  }
}

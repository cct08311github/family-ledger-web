import { toDate } from './utils'
import type { Expense } from './types'

export interface CategorySummary {
  name: string
  amount: number
  /** 0..1 share of YTD total. */
  pct: number
}

export interface MonthSummary {
  /** 1..12 (1-indexed for human readability). */
  month: number
  amount: number
}

export interface YearRecapData {
  year: number
  /** YTD total for current year. */
  ytdTotal: number
  daysSoFarInYear: number
  daysInYear: number
  /** Linear annual extrapolation (`ytdTotal / daysSoFar * daysInYear`). */
  projectedAnnual: number
  /** Sum of last year's expenses up to same day-of-year. null if not enough data. */
  lastYearSamePeriodTotal: number | null
  /** Sum of last year's full-year expenses, null when incomplete history. */
  lastYearTotal: number | null
  /** ytdTotal - lastYearSamePeriodTotal. null when no comparable. */
  vsLastYearSameDate: number | null
  /** Top YTD category. null when no spending. */
  topCategory: CategorySummary | null
  /** Highest-spend calendar month YTD (1-indexed). null when no data. */
  topMonth: MonthSummary | null
}

interface AnalyzeOptions {
  expenses: Expense[]
  now?: number
  /** Min days into the year before producing analysis. Default 30. */
  minDaysSoFar?: number
  /** Min days of last-year data to surface comparisons. Default 30. */
  minLastYearDays?: number
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInYearFor(year: number): number {
  return isLeap(year) ? 366 : 365
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  return Math.floor(diff / 86_400_000)
}

/**
 * Year-to-date overview with last-year same-period comparison. Produces
 * the only annual-cadence widget on the home page — fills the
 * "year" gap left by the rest of the time-axis stack
 * (day → week → month).
 */
export function analyzeYearRecap({
  expenses,
  now = Date.now(),
  minDaysSoFar = 30,
  minLastYearDays = 30,
}: AnalyzeOptions): YearRecapData | null {
  const today = new Date(now)
  const year = today.getFullYear()
  const daysSoFarInYear = dayOfYear(today)
  if (daysSoFarInYear < minDaysSoFar) return null
  const daysInYear = daysInYearFor(year)

  const lastYear = year - 1
  const lastYearSamePeriodCutoff = new Date(lastYear, 0, 1)
  lastYearSamePeriodCutoff.setDate(daysSoFarInYear)
  lastYearSamePeriodCutoff.setHours(23, 59, 59, 999)

  const ytdByCategory = new Map<string, number>()
  const ytdByMonth = new Map<number, number>()
  let ytdTotal = 0
  let lastYearSamePeriodTotal = 0
  let lastYearSamePeriodCount = 0
  let lastYearTotal = 0
  let lastYearTotalCount = 0

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

    if (d.getFullYear() === year && d.getTime() <= today.getTime()) {
      ytdTotal += amount
      const category = (e.category || '其他').trim() || '其他'
      ytdByCategory.set(category, (ytdByCategory.get(category) ?? 0) + amount)
      const m = d.getMonth() + 1
      ytdByMonth.set(m, (ytdByMonth.get(m) ?? 0) + amount)
    } else if (d.getFullYear() === lastYear) {
      lastYearTotal += amount
      lastYearTotalCount++
      if (d.getTime() <= lastYearSamePeriodCutoff.getTime()) {
        lastYearSamePeriodTotal += amount
        lastYearSamePeriodCount++
      }
    }
  }

  if (ytdTotal <= 0) return null

  const projectedAnnual = (ytdTotal / daysSoFarInYear) * daysInYear

  let topCategory: CategorySummary | null = null
  for (const [name, amount] of ytdByCategory) {
    if (!topCategory || amount > topCategory.amount) {
      topCategory = { name, amount, pct: amount / ytdTotal }
    }
  }

  let topMonth: MonthSummary | null = null
  for (const [month, amount] of ytdByMonth) {
    if (!topMonth || amount > topMonth.amount) {
      topMonth = { month, amount }
    }
  }

  const lastYearComparable = lastYearSamePeriodCount >= minLastYearDays
  const lastYearFull = lastYearTotalCount >= minLastYearDays

  return {
    year,
    ytdTotal,
    daysSoFarInYear,
    daysInYear,
    projectedAnnual,
    lastYearSamePeriodTotal: lastYearComparable ? lastYearSamePeriodTotal : null,
    lastYearTotal: lastYearFull ? lastYearTotal : null,
    vsLastYearSameDate: lastYearComparable
      ? ytdTotal - lastYearSamePeriodTotal
      : null,
    topCategory,
    topMonth,
  }
}

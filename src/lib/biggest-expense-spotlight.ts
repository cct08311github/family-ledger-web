import { toDate } from './utils'
import type { Expense } from './types'

export interface BiggestExpenseEntry {
  id: string
  description: string
  amount: number
  /** Date as YYYY-MM-DD (local). */
  dateLabel: string
  category: string
  payerName: string
}

export interface BiggestExpenseSpotlight {
  /** The single largest expense of the current calendar month. */
  biggest: BiggestExpenseEntry
  /** Up to 3 largest expenses of the current month, including biggest at index 0. */
  monthTop: BiggestExpenseEntry[]
  /**
   * Percentile rank of `biggest.amount` among the trailing N-month single-amount
   * distribution (excluding current month). null when historical sample too thin.
   */
  pctile: number | null
  /** Count of historical expenses used to compute pctile. */
  historicalCount: number
  monthLabel: string
}

interface AnalyzeOptions {
  expenses: Expense[]
  now?: number
  /** Days into the month before analysis runs. Default 5. */
  minDaysSoFar?: number
  /** Trailing months for historical comparison. Default 6. */
  historicalMonths?: number
  /** Minimum historical sample count required for pctile. Default 10. */
  minHistoricalCount?: number
  /** How many top expenses to surface. Default 3. */
  topN?: number
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toEntry(e: Expense, d: Date): BiggestExpenseEntry {
  return {
    id: e.id,
    description: (e.description || '(無描述)').trim() || '(無描述)',
    amount: Number(e.amount),
    dateLabel: dateKey(d),
    category: (e.category || '其他').trim() || '其他',
    payerName: (e.payerName || '').trim() || '?',
  }
}

/**
 * Surface the biggest single-line expense of the current month with a
 * percentile-rank against the trailing N-month distribution. Distinct
 * from form-side outlier-detector (#284) which warns *before* a record
 * is saved — this one celebrates / explains *after* the fact.
 */
export function analyzeBiggestExpense({
  expenses,
  now = Date.now(),
  minDaysSoFar = 5,
  historicalMonths = 6,
  minHistoricalCount = 10,
  topN = 3,
}: AnalyzeOptions): BiggestExpenseSpotlight | null {
  const today = new Date(now)
  if (today.getDate() < minDaysSoFar) return null

  const year = today.getFullYear()
  const month = today.getMonth()
  const monthLabel = `${year}-${String(month + 1).padStart(2, '0')}`

  const historyStart = new Date(year, month - historicalMonths, 1)
  const historyStartMs = historyStart.getTime()

  const currentMonthExpenses: BiggestExpenseEntry[] = []
  const historicalAmounts: number[] = []

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

    const isCurrentMonth = d.getFullYear() === year && d.getMonth() === month
    if (isCurrentMonth) {
      currentMonthExpenses.push(toEntry(e, d))
    } else if (d.getTime() >= historyStartMs) {
      historicalAmounts.push(amount)
    }
  }

  if (currentMonthExpenses.length === 0) return null

  currentMonthExpenses.sort((a, b) => b.amount - a.amount)
  const biggest = currentMonthExpenses[0]
  const monthTop = currentMonthExpenses.slice(0, topN)

  let pctile: number | null = null
  if (historicalAmounts.length >= minHistoricalCount) {
    const lessOrEqual = historicalAmounts.filter((a) => a <= biggest.amount).length
    pctile = lessOrEqual / historicalAmounts.length
  }

  return {
    biggest,
    monthTop,
    pctile,
    historicalCount: historicalAmounts.length,
    monthLabel,
  }
}

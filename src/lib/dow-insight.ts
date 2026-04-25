import { toDate } from './utils'
import type { Expense } from './types'

export interface DowInsightData {
  /** Average spending per occurrence of each weekday (index 0=Sun..6=Sat). */
  averages: number[]
  /** Total spending per weekday across the window. */
  totals: number[]
  /** Number of distinct dates falling on each weekday within the window. */
  occurrences: number[]
  /** Day-of-week with highest average. */
  peakDow: number
  /** Day-of-week with lowest non-zero average, or null if no spending. */
  lowestDow: number | null
  /** peakAvg / lowestAvg, or null if either is zero. */
  peakRatio: number | null
  /** Share of total spending on Saturday + Sunday (0..1). */
  weekendShare: number
  /** Distinct dates with positive spending in window. Quality signal. */
  totalSpendingDays: number
  /** Window length in days. */
  windowDays: number
}

interface AnalyzeOptions {
  expenses: Expense[]
  /** Now in epoch ms; defaults to Date.now(). */
  now?: number
  /** Window length back from today (inclusive). Default 60. */
  days?: number
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Cyclical day-of-week aggregation over a rolling window. Uses occurrence
 * counts per weekday so averages are stable when the window is uneven (60
 * days = 8-9 of each weekday). Returns null only for malformed window input;
 * an all-zero result is still meaningful (caller decides whether to render).
 */
export function analyzeDayOfWeekPattern({
  expenses,
  now = Date.now(),
  days = 60,
}: AnalyzeOptions): DowInsightData | null {
  if (!Number.isFinite(days) || days <= 0) return null

  const endLocal = new Date(now)
  endLocal.setHours(23, 59, 59, 999)
  const startLocal = new Date(endLocal)
  startLocal.setDate(startLocal.getDate() - (days - 1))
  startLocal.setHours(0, 0, 0, 0)
  const startMs = startLocal.getTime()
  const endMs = endLocal.getTime()

  const dateTotals = new Map<string, number>()

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
    if (!Number.isFinite(ts) || ts < startMs || ts > endMs) continue
    const k = dateKey(d)
    dateTotals.set(k, (dateTotals.get(k) ?? 0) + amount)
  }

  const totals = [0, 0, 0, 0, 0, 0, 0]
  const occurrences = [0, 0, 0, 0, 0, 0, 0]
  const cur = new Date(startLocal)
  for (let i = 0; i < days; i++) {
    const dow = cur.getDay()
    occurrences[dow]++
    totals[dow] += dateTotals.get(dateKey(cur)) ?? 0
    cur.setDate(cur.getDate() + 1)
  }

  const averages = totals.map((t, i) => (occurrences[i] > 0 ? t / occurrences[i] : 0))

  let peakDow = 0
  for (let i = 1; i < 7; i++) {
    if (averages[i] > averages[peakDow]) peakDow = i
  }

  let lowestDow: number | null = null
  for (let i = 0; i < 7; i++) {
    if (averages[i] > 0 && (lowestDow === null || averages[i] < averages[lowestDow])) {
      lowestDow = i
    }
  }

  const peakRatio =
    lowestDow !== null && averages[lowestDow] > 0 && averages[peakDow] > 0
      ? averages[peakDow] / averages[lowestDow]
      : null

  const totalSpend = totals.reduce((s, x) => s + x, 0)
  const weekendSpend = totals[0] + totals[6]
  const weekendShare = totalSpend > 0 ? weekendSpend / totalSpend : 0

  return {
    averages,
    totals,
    occurrences,
    peakDow,
    lowestDow,
    peakRatio,
    weekendShare,
    totalSpendingDays: dateTotals.size,
    windowDays: days,
  }
}

const DOW_LABEL_TC = ['日', '一', '二', '三', '四', '五', '六']

export function dowLabelTC(dow: number): string {
  return DOW_LABEL_TC[dow] ?? '?'
}

/**
 * Whether the data is "interesting enough" to surface as a banner.
 * Filter out trivial windows (too little spending, too little variation)
 * so the home page only shows insights worth reading.
 */
export function isInsightWorthShowing(d: DowInsightData): boolean {
  if (d.totalSpendingDays < 5) return false
  const totalSpend = d.totals.reduce((s, x) => s + x, 0)
  if (totalSpend < 1000) return false
  const significantRatio = d.peakRatio !== null && d.peakRatio >= 1.5
  const significantWeekend = d.weekendShare >= 0.55 || d.weekendShare > 0 && d.weekendShare <= 0.2
  return significantRatio || significantWeekend
}

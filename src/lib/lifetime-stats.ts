import { toDate } from './utils'
import type { Expense } from './types'

export interface LifetimeStatsData {
  /** YYYY-MM-DD of earliest recorded expense (by date field). */
  firstRecordDate: string
  /** Days from firstRecordDate to today (inclusive). */
  totalDaysSinceFirst: number
  /** Total expense count (excludes bad data). */
  totalCount: number
  /** Sum of all amounts. */
  totalAmount: number
  /** Distinct calendar days with at least one recorded expense. */
  daysRecorded: number
  /** daysRecorded / totalDaysSinceFirst, 0..1. */
  recordingRate: number
  /** Largest single expense ever. */
  biggestSingleExpense: {
    description: string
    amount: number
    date: string
    category: string
  }
  /** Calendar month with highest total spend. */
  highestMonth: {
    label: string // YYYY-MM
    amount: number
  }
  /** Longest consecutive run of recorded calendar days. */
  longestStreak: number
}

interface AggregateOptions {
  expenses: Expense[]
  now?: number
  /** Min days from firstRecord before producing stats. Default 14. */
  minDaysSinceFirst?: number
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function computeLongestStreak(dateKeys: Set<string>): number {
  if (dateKeys.size === 0) return 0
  const sorted = Array.from(dateKeys).sort()
  let longest = 0
  let runLen = 0
  let prevTs = -Infinity
  for (const k of sorted) {
    const [y, m, d] = k.split('-').map(Number)
    const ts = new Date(y, m - 1, d).getTime()
    if (prevTs !== -Infinity && ts - prevTs === 86_400_000) {
      runLen++
    } else {
      runLen = 1
    }
    if (runLen > longest) longest = runLen
    prevTs = ts
  }
  return longest
}

/**
 * Lifetime self-narrative for the settings page (Issue #327). Distinct
 * from analytical widgets — this is emotional / commemorative, like a
 * static "since you started" summary card.
 */
export function aggregateLifetimeStats({
  expenses,
  now = Date.now(),
  minDaysSinceFirst = 14,
}: AggregateOptions): LifetimeStatsData | null {
  let totalCount = 0
  let totalAmount = 0
  let earliestTs = Infinity
  let biggest: LifetimeStatsData['biggestSingleExpense'] | null = null
  const monthTotals = new Map<string, number>()
  const dateKeys = new Set<string>()

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
    if (!Number.isFinite(ts) || ts <= 0) continue
    if (ts < earliestTs) earliestTs = ts
    totalCount++
    totalAmount += amount
    monthTotals.set(monthKey(d), (monthTotals.get(monthKey(d)) ?? 0) + amount)
    dateKeys.add(dateKey(d))
    if (!biggest || amount > biggest.amount) {
      biggest = {
        description: (e.description || '(無描述)').trim() || '(無描述)',
        amount,
        date: dateKey(d),
        category: (e.category || '其他').trim() || '其他',
      }
    }
  }

  if (totalCount === 0 || !biggest) return null
  if (!Number.isFinite(earliestTs)) return null

  const today = startOfDay(new Date(now))
  const firstRecordDay = startOfDay(new Date(earliestTs))
  const totalDaysSinceFirst = Math.max(
    1,
    Math.floor((today.getTime() - firstRecordDay.getTime()) / 86_400_000) + 1,
  )

  if (totalDaysSinceFirst < minDaysSinceFirst) return null

  let highestMonth: LifetimeStatsData['highestMonth'] = { label: '', amount: 0 }
  for (const [label, amount] of monthTotals) {
    if (amount > highestMonth.amount) {
      highestMonth = { label, amount }
    }
  }

  return {
    firstRecordDate: dateKey(firstRecordDay),
    totalDaysSinceFirst,
    totalCount,
    totalAmount,
    daysRecorded: dateKeys.size,
    recordingRate: dateKeys.size / totalDaysSinceFirst,
    biggestSingleExpense: biggest,
    highestMonth,
    longestStreak: computeLongestStreak(dateKeys),
  }
}

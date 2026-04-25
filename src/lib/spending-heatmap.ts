/**
 * Aggregate expenses into a fixed-size daily window for heatmap rendering
 * (Issue #290). Pure function — caller passes raw expenses + window size,
 * receives an array of {date, total, count} aligned to consecutive days
 * ending today.
 */
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

export interface DailyBucket {
  /** ISO YYYY-MM-DD. */
  date: string
  total: number
  count: number
  /** 0..1 intensity vs the max bucket in the same window. 0 when empty. */
  intensity: number
}

interface AggregateInput {
  expenses: readonly Expense[]
  /** How many days back from `now`, inclusive of today. */
  days: number
  now?: number
}

function startOfDay(t: number): number {
  const d = new Date(t)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

function isoDay(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function aggregateDailyBuckets({
  expenses,
  days,
  now = Date.now(),
}: AggregateInput): DailyBucket[] {
  if (days <= 0) return []

  // Build the window from `days-1` days ago up to today, in local time
  const today = new Date(now)
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const windowStartTs = todayLocal.getTime() - (days - 1) * 86_400_000

  // Index expenses by local-day key
  const byDay = new Map<string, { total: number; count: number }>()
  for (const e of expenses) {
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount)) continue
    let dt: Date
    try {
      dt = toDate(e.date)
    } catch {
      continue
    }
    if (!Number.isFinite(dt.getTime())) continue
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    const cur = byDay.get(key) ?? { total: 0, count: 0 }
    cur.total += e.amount
    cur.count += 1
    byDay.set(key, cur)
  }

  // Build the consecutive-day array
  const buckets: DailyBucket[] = []
  for (let i = 0; i < days; i++) {
    const t = windowStartTs + i * 86_400_000
    const localD = new Date(t)
    // Use local date components — startOfDay used UTC variant which is
    // fine for stable iso keys but we want match against byDay keys which
    // are local. Recompute the local key here.
    const key = `${localD.getFullYear()}-${String(localD.getMonth() + 1).padStart(2, '0')}-${String(localD.getDate()).padStart(2, '0')}`
    const data = byDay.get(key) ?? { total: 0, count: 0 }
    buckets.push({ date: key, total: data.total, count: data.count, intensity: 0 })
  }

  // Compute intensity 0..1 against window max
  let max = 0
  for (const b of buckets) if (b.total > max) max = b.total
  if (max > 0) {
    for (const b of buckets) {
      b.intensity = b.total / max
    }
  }

  return buckets
}

/** Pure helper exported for tests. */
export { startOfDay, isoDay }

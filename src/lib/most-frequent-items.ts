import { toDate } from './utils'
import type { Expense } from './types'

export interface FrequentItem {
  description: string
  count: number
  totalAmount: number
  averagePrice: number
  /** Most recent occurrence as YYYY-MM-DD (local). */
  lastDate: string
}

interface AnalyzeOptions {
  expenses: Expense[]
  now?: number
  /** Days back from today (inclusive). Default 90. */
  days?: number
  /** Min occurrences to qualify. Default 3. */
  minCount?: number
  /** Top N items to return. Default 5. */
  limit?: number
}

function normalize(description: string): string {
  return (description ?? '').trim().toLowerCase()
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Top recurring purchases by `description` over a rolling window. Surfaces
 * the user's habitual buys (the "every Wednesday lunch" tier) and their
 * average price, which doubles as a cheap price anchor for future entries.
 *
 * Description normalization is conservative — trim + lowercase only —
 * because aggressive stemming would conflate distinct items the user types
 * deliberately ("便當" vs "便當盒").
 */
export function analyzeMostFrequent({
  expenses,
  now = Date.now(),
  days = 90,
  minCount = 3,
  limit = 5,
}: AnalyzeOptions): FrequentItem[] {
  if (!Number.isFinite(days) || days <= 0) return []

  const endLocal = new Date(now)
  endLocal.setHours(23, 59, 59, 999)
  const startLocal = new Date(endLocal)
  startLocal.setDate(startLocal.getDate() - (days - 1))
  startLocal.setHours(0, 0, 0, 0)
  const startMs = startLocal.getTime()
  const endMs = endLocal.getTime()

  type Acc = {
    display: string
    count: number
    totalAmount: number
    lastTs: number
  }
  const buckets = new Map<string, Acc>()

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
    const description = (e.description ?? '').trim()
    if (!description) continue
    const key = normalize(description)
    if (!key) continue

    const acc = buckets.get(key) ?? {
      display: description,
      count: 0,
      totalAmount: 0,
      lastTs: 0,
    }
    acc.count++
    acc.totalAmount += amount
    if (ts > acc.lastTs) {
      acc.display = description
      acc.lastTs = ts
    }
    buckets.set(key, acc)
  }

  const items: FrequentItem[] = []
  for (const acc of buckets.values()) {
    if (acc.count < minCount) continue
    items.push({
      description: acc.display,
      count: acc.count,
      totalAmount: acc.totalAmount,
      averagePrice: acc.totalAmount / acc.count,
      lastDate: dateKey(new Date(acc.lastTs)),
    })
  }

  items.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.totalAmount - a.totalAmount
  })

  return items.slice(0, limit)
}

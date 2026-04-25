import type { Expense } from './types'

export interface FilterStatsData {
  count: number
  total: number
  average: number
  median: number
  max: number
  min: number
}

interface ComputeOptions {
  expenses: Expense[]
  /** Min count before stats are meaningful. Default 3. */
  minCount?: number
}

/**
 * Distribution stats over a filtered slice of expenses. Complements the
 * existing "count + total" line on /records by showing the *shape* of
 * the slice: average, median, range. Returns null below a small-sample
 * threshold where stats would be misleading.
 */
export function computeFilterStats({
  expenses,
  minCount = 3,
}: ComputeOptions): FilterStatsData | null {
  const amounts: number[] = []
  for (const e of expenses) {
    const amount = Number(e.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    amounts.push(amount)
  }

  if (amounts.length < minCount) return null

  amounts.sort((a, b) => a - b)
  const n = amounts.length
  const total = amounts.reduce((s, x) => s + x, 0)
  const average = total / n
  const median =
    n % 2 === 1 ? amounts[(n - 1) / 2] : (amounts[n / 2 - 1] + amounts[n / 2]) / 2
  const max = amounts[n - 1]
  const min = amounts[0]

  return { count: n, total, average, median, max, min }
}

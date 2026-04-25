/**
 * Pick the N largest expenses for a "top spends" widget (Issue #278).
 *
 * Pure function. Sort key: amount desc; tie-break: newer date first
 * (so today's NT$1000 outranks yesterday's same-amount). Skips
 * non-finite amounts defensively.
 */
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

export function topNExpenses(expenses: readonly Expense[], n: number): Expense[] {
  if (n <= 0) return []
  const valid: Array<{ e: Expense; t: number }> = []
  for (const e of expenses) {
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount)) continue
    let t: number
    try {
      const d = toDate(e.date)
      t = d.getTime()
    } catch {
      t = 0
    }
    valid.push({ e, t })
  }
  valid.sort((a, b) => {
    if (b.e.amount !== a.e.amount) return b.e.amount - a.e.amount
    return b.t - a.t
  })
  return valid.slice(0, n).map((v) => v.e)
}

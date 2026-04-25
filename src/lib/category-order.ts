import { toDate } from './utils'
import type { Expense } from './types'

interface SortOptions {
  categories: string[]
  expenses: Expense[]
  /** Days back to consider for frequency. Default 30. */
  days?: number
  /** Now in epoch ms; defaults to Date.now(). */
  now?: number
}

/**
 * Reorder a list of category names by recent usage frequency. The result
 * preserves all input categories (no drops) — categories that haven't been
 * used recently keep their original relative order, sorted to the end.
 *
 * Pure: input arrays are not mutated.
 */
export function sortCategoriesByFrequency({
  categories,
  expenses,
  days = 30,
  now = Date.now(),
}: SortOptions): string[] {
  if (categories.length === 0) return []

  const cutoff = now - days * 86_400_000
  const counts = new Map<string, number>()

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
    if (!Number.isFinite(ts) || ts < cutoff || ts > now) continue
    const cat = (e.category || '').trim()
    if (!cat) continue
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }

  const indexInOriginal = new Map<string, number>()
  categories.forEach((c, i) => indexInOriginal.set(c, i))

  return categories.slice().sort((a, b) => {
    const ca = counts.get(a) ?? 0
    const cb = counts.get(b) ?? 0
    if (ca !== cb) return cb - ca
    return (indexInOriginal.get(a) ?? 0) - (indexInOriginal.get(b) ?? 0)
  })
}

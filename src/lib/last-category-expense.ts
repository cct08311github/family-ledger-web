/**
 * Find the most recent expense matching a category for the "上次此類別金額"
 * hint on expense forms (Issue #252). Pure function — the caller holds the
 * expenses array (already sorted desc by date via useExpenses).
 *
 * Matches case-insensitive, trimmed category — so "餐飲" and " 餐飲 " collide.
 * Returns null when the category is empty or no match exists.
 */
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

export interface LastCategoryMatch {
  expense: Expense
  date: Date
}

export function findLastExpenseByCategory(
  expenses: readonly Expense[],
  category: string | undefined | null,
  /** Optional exclude id — used when editing an expense so we don't cite itself. */
  excludeId?: string,
): LastCategoryMatch | null {
  if (!category) return null
  const normalized = category.trim().toLowerCase()
  if (!normalized) return null

  let best: LastCategoryMatch | null = null
  for (const e of expenses) {
    if (excludeId && e.id === excludeId) continue
    if (!e.category) continue
    if (e.category.trim().toLowerCase() !== normalized) continue
    const d = toDate(e.date)
    if (!best || d > best.date) best = { expense: e, date: d }
  }
  return best
}

/**
 * Short relative-day label. Reused logic pattern identical to
 * recurring-next.ts — kept inline here to avoid a cross-module import
 * for a 5-line helper.
 */
export function relativeDays(target: Date, now: Date): string {
  const msPerDay = 86_400_000
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((a - b) / msPerDay)
  if (diff === 0) return '今天'
  if (diff === -1) return '昨天'
  if (diff < 0) return `${Math.abs(diff)} 天前`
  if (diff === 1) return '明天'
  return `${diff} 天後`
}

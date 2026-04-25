import { toDate } from './utils'
import type { Expense } from './types'

export type CategoryChangeKind = 'grew' | 'shrank' | 'new' | 'gone'

export interface CategoryChange {
  category: string
  current: number
  previous: number
  deltaAmount: number
  /** null when `previous === 0` (new category) — pct undefined. */
  deltaPct: number | null
  kind: CategoryChangeKind
}

export interface CategoryMoMData {
  /** Most significant changes, sorted by absolute deltaAmount desc. */
  changes: CategoryChange[]
  currentMonthTotal: number
  previousMonthTotal: number
  /** Calendar month label e.g. "2026-04". */
  currentMonthLabel: string
  previousMonthLabel: string
}

interface AnalyzeOptions {
  expenses: Expense[]
  now?: number
  /** Minimum days into the month before producing analysis. Default 7. */
  minDaysSoFar?: number
  /** Minimum |deltaAmount| (NT$) to count as significant. Default 500. */
  minDeltaAmount?: number
  /** Minimum |deltaPct| (0..1) to count as significant. Default 0.3. */
  minDeltaPct?: number
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * Per-category month-over-month change. Surfaces "what shifted" between
 * last month and current month, separately from total-amount change. Hides
 * trivial moves (small absolute or small percentage) so the home page only
 * shows changes worth a second look.
 */
export function analyzeCategoryMoM({
  expenses,
  now = Date.now(),
  minDaysSoFar = 7,
  minDeltaAmount = 500,
  minDeltaPct = 0.3,
}: AnalyzeOptions): CategoryMoMData | null {
  const today = new Date(now)
  const daysSoFar = today.getDate()
  if (daysSoFar < minDaysSoFar) return null

  const year = today.getFullYear()
  const month = today.getMonth()
  const prev = new Date(year, month - 1, 1)
  const prevYear = prev.getFullYear()
  const prevMonth = prev.getMonth()

  const currentMonthLabel = monthKey(year, month)
  const previousMonthLabel = monthKey(prevYear, prevMonth)

  const currentByCategory = new Map<string, number>()
  const previousByCategory = new Map<string, number>()

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
    const category = (e.category || '其他').trim() || '其他'
    if (d.getFullYear() === year && d.getMonth() === month) {
      currentByCategory.set(category, (currentByCategory.get(category) ?? 0) + amount)
    } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
      previousByCategory.set(category, (previousByCategory.get(category) ?? 0) + amount)
    }
  }

  const currentMonthTotal = Array.from(currentByCategory.values()).reduce((s, x) => s + x, 0)
  const previousMonthTotal = Array.from(previousByCategory.values()).reduce((s, x) => s + x, 0)

  if (currentMonthTotal === 0 && previousMonthTotal === 0) return null

  const allCategories = new Set<string>([
    ...currentByCategory.keys(),
    ...previousByCategory.keys(),
  ])

  const changes: CategoryChange[] = []
  for (const category of allCategories) {
    const current = currentByCategory.get(category) ?? 0
    const previous = previousByCategory.get(category) ?? 0
    const deltaAmount = current - previous

    let kind: CategoryChangeKind
    if (previous === 0 && current > 0) {
      kind = 'new'
    } else if (current === 0 && previous > 0) {
      kind = 'gone'
    } else if (deltaAmount > 0) {
      kind = 'grew'
    } else {
      kind = 'shrank'
    }

    const deltaPct = previous > 0 ? deltaAmount / previous : null

    if (Math.abs(deltaAmount) < minDeltaAmount) continue
    if (kind === 'grew' || kind === 'shrank') {
      if (deltaPct !== null && Math.abs(deltaPct) < minDeltaPct) continue
    }

    changes.push({ category, current, previous, deltaAmount, deltaPct, kind })
  }

  changes.sort((a, b) => Math.abs(b.deltaAmount) - Math.abs(a.deltaAmount))

  return {
    changes,
    currentMonthTotal,
    previousMonthTotal,
    currentMonthLabel,
    previousMonthLabel,
  }
}

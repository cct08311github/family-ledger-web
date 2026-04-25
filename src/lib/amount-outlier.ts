/**
 * Detect "looks like a typo" amounts at save time (Issue #284).
 *
 * Two independent signals against the user's history of the same category
 * over the last ~3 months:
 *
 * 1. Digit-length jump: if the current amount has 2+ more digits than the
 *    historical maximum in that category, it's almost certainly a misplaced
 *    zero ("you typed 1500, did you mean 150?").
 * 2. Magnitude jump: if the current amount is more than 5× the historical
 *    median (after the digit-length signal already cleared), it's a softer
 *    nudge ("usually this category lands near NT$ X").
 *
 * Sample size guard: with fewer than 3 historical samples we don't fire —
 * not enough signal, false positives would annoy.
 *
 * Pure function. No date library — caller filters expenses to the recent
 * window before passing in.
 */
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

export type OutlierKind = 'digit_jump' | 'magnitude_jump'

export interface OutlierResult {
  isOutlier: boolean
  kind: OutlierKind | null
  /** Median of the historical sample, for use in the message. */
  historicalMedian: number | null
  /** Sample size used. */
  sampleSize: number
}

const DEFAULT_LOOKBACK_DAYS = 90
const MIN_SAMPLE_SIZE = 3
const MAGNITUDE_RATIO = 5

function digitCount(n: number): number {
  if (n <= 0) return 0
  return String(Math.floor(n)).length
}

function median(arr: readonly number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const m = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m]
}

interface DetectInput {
  amount: number
  category: string
  /** Caller's full visible expense list — function filters internally. */
  expenses: readonly Expense[]
  /** Optional now (for tests). Defaults to Date.now(). */
  now?: number
  /** Optional id of the expense being edited — exclude from history. */
  excludeId?: string
}

export function detectAmountOutlier({
  amount,
  category,
  expenses,
  now = Date.now(),
  excludeId,
}: DetectInput): OutlierResult {
  if (!Number.isFinite(amount) || amount <= 0 || !category) {
    return { isOutlier: false, kind: null, historicalMedian: null, sampleSize: 0 }
  }

  const cutoff = now - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  const normalized = category.trim().toLowerCase()

  const historicalAmounts: number[] = []
  for (const e of expenses) {
    if (e.id === excludeId) continue
    if (!e.category || e.category.trim().toLowerCase() !== normalized) continue
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount) || e.amount <= 0) continue
    let t: number
    try {
      const d = toDate(e.date)
      t = d.getTime()
    } catch {
      continue
    }
    if (!Number.isFinite(t) || t < cutoff) continue
    historicalAmounts.push(e.amount)
  }

  if (historicalAmounts.length < MIN_SAMPLE_SIZE) {
    return { isOutlier: false, kind: null, historicalMedian: null, sampleSize: historicalAmounts.length }
  }

  const med = median(historicalAmounts)
  const maxDigits = Math.max(...historicalAmounts.map(digitCount))
  const currentDigits = digitCount(amount)

  // Signal 1: digit jump — clearer error, prefer this message
  if (currentDigits >= maxDigits + 2) {
    return { isOutlier: true, kind: 'digit_jump', historicalMedian: med, sampleSize: historicalAmounts.length }
  }

  // Signal 2: magnitude jump
  if (med > 0 && amount > med * MAGNITUDE_RATIO) {
    return { isOutlier: true, kind: 'magnitude_jump', historicalMedian: med, sampleSize: historicalAmounts.length }
  }

  return { isOutlier: false, kind: null, historicalMedian: med, sampleSize: historicalAmounts.length }
}

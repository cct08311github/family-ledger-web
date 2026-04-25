import { toDate } from './utils'
import type { Expense } from './types'

export interface QuickAddSuggestion {
  description: string
  amount: number
  category: string
  /** 0..1 — share of matching combo within hour-of-week window. */
  confidence: number
  /** Total expenses contributing to the suggestion (supporting evidence). */
  basedOn: number
  /** ID of the most recent contributing expense — used as ?duplicate= source. */
  sourceId: string
}

interface SuggestOptions {
  expenses: Expense[]
  now?: number
  /** Days back to consider. Default 90. */
  windowDays?: number
  /** Hour-window padding (±N). Default 2. */
  hourPadding?: number
  /** Minimum supporting expenses. Default 3. */
  minSupport?: number
  /** Minimum confidence to surface. Default 0.4. */
  minConfidence?: number
}

function normalize(s: string): string {
  return (s ?? '').trim().toLowerCase()
}

/**
 * Predict the most likely next expense based on the user's day-of-week +
 * hour-window habit profile. Returns null when no historical pattern is
 * confident enough to surface — better to stay silent than show a weak
 * guess on the quick-add bar.
 *
 * Hour matching uses a ±2-hour window so 11:59 lunch and 12:01 lunch are
 * treated as the same slot. Day-of-week is exact.
 */
export function suggestNextExpense({
  expenses,
  now = Date.now(),
  windowDays = 90,
  hourPadding = 2,
  minSupport = 3,
  minConfidence = 0.4,
}: SuggestOptions): QuickAddSuggestion | null {
  const today = new Date(now)
  const targetDow = today.getDay()
  const targetHour = today.getHours()
  const cutoff = now - windowDays * 86_400_000

  type ComboKey = string
  interface ComboAcc {
    description: string
    amount: number
    category: string
    count: number
    /** Most recent expense id contributing — used by caller as ?duplicate= source. */
    latestId: string
    latestTs: number
  }
  const combos = new Map<ComboKey, ComboAcc>()
  let windowMatchCount = 0

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
    if (d.getDay() !== targetDow) continue
    const hourDelta = Math.abs(d.getHours() - targetHour)
    if (hourDelta > hourPadding) continue

    const description = (e.description ?? '').trim()
    if (!description) continue
    const category = (e.category || '其他').trim() || '其他'
    const normDesc = normalize(description)
    const key = `${normDesc}|${amount}`

    const existing = combos.get(key)
    if (existing) {
      existing.count++
      if (ts > existing.latestTs) {
        existing.latestTs = ts
        existing.latestId = e.id
      }
    } else {
      combos.set(key, {
        description, // keep original case from first occurrence
        amount,
        category,
        count: 1,
        latestId: e.id,
        latestTs: ts,
      })
    }
    windowMatchCount++
  }

  if (windowMatchCount === 0) return null

  let best: ComboAcc | null = null
  for (const acc of combos.values()) {
    if (!best || acc.count > best.count) best = acc
  }

  if (!best || best.count < minSupport) return null

  const confidence = best.count / windowMatchCount
  if (confidence < minConfidence) return null

  return {
    description: best.description,
    amount: best.amount,
    category: best.category,
    confidence,
    basedOn: best.count,
    sourceId: best.latestId,
  }
}

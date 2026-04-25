/**
 * Detect "hidden subscriptions" from expense history (Issue #286).
 *
 * Mines the last ~90 days of expenses for repeating (description, amount)
 * pairs that occur on a roughly monthly or weekly cadence — exactly the
 * pattern of forgotten Netflix/utility/membership payments. Suggests
 * converting them into a `recurringExpenses` template the user already
 * has infrastructure for.
 *
 * Pure function. No date library. Caller filters to visible expenses.
 */
import { toDate } from '@/lib/utils'
import type { Expense, RecurringExpense } from '@/lib/types'

export type CadenceKind = 'monthly' | 'weekly'

export interface SubscriptionCandidate {
  /** Trimmed (case-preserved) description used as the matching key. */
  description: string
  amount: number
  category: string
  cadence: CadenceKind
  occurrences: number
  /** ISO date strings of detected occurrences, sorted ascending. */
  dates: string[]
  /** Day-of-month (1..31) suggested for monthly templates, null for weekly. */
  suggestedDayOfMonth: number | null
  /** Day-of-week (0..6 Sun..Sat) suggested for weekly templates, null for monthly. */
  suggestedDayOfWeek: number | null
}

const LOOKBACK_DAYS = 90
const MONTHLY_LO = 28
const MONTHLY_HI = 32
const WEEKLY_LO = 6
const WEEKLY_HI = 8

interface DetectInput {
  expenses: readonly Expense[]
  /** Existing recurring templates — used to skip already-managed subscriptions. */
  recurringTemplates: readonly RecurringExpense[]
  now?: number
}

interface DateSafe {
  e: Expense
  t: number
}

function safeT(e: Expense): number | null {
  try {
    const d = toDate(e.date)
    const t = d.getTime()
    return Number.isFinite(t) ? t : null
  } catch {
    return null
  }
}

function isoDate(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function classifyCadence(deltaDays: number): CadenceKind | null {
  if (deltaDays >= MONTHLY_LO && deltaDays <= MONTHLY_HI) return 'monthly'
  if (deltaDays >= WEEKLY_LO && deltaDays <= WEEKLY_HI) return 'weekly'
  return null
}

function modeOrFirst<T extends number>(values: readonly T[]): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: T = values[0]
  let bestCount = 0
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v
      bestCount = c
    }
  }
  return best
}

export function detectSubscriptionCandidates({
  expenses,
  recurringTemplates,
  now = Date.now(),
}: DetectInput): SubscriptionCandidate[] {
  const cutoff = now - LOOKBACK_DAYS * 86_400_000

  // Group by normalized (description, amount). Skip personal (isShared=false)
  // and already-managed (existing recurring template).
  const managed = new Set<string>()
  for (const r of recurringTemplates) {
    if (!r.description) continue
    managed.add(r.description.trim().toLowerCase())
  }

  const groups = new Map<string, DateSafe[]>()
  for (const e of expenses) {
    if (!e.isShared) continue
    if (!e.description || !e.description.trim()) continue
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount) || e.amount <= 0) continue
    const t = safeT(e)
    if (t === null || t < cutoff) continue
    const desc = e.description.trim()
    if (managed.has(desc.toLowerCase())) continue
    const key = `${desc.toLowerCase()}|${e.amount}`
    const arr = groups.get(key) ?? []
    arr.push({ e, t })
    groups.set(key, arr)
  }

  const candidates: SubscriptionCandidate[] = []
  for (const [, items] of groups) {
    if (items.length < 2) continue
    items.sort((a, b) => a.t - b.t)

    // Compute consecutive gaps in days. Need at least one gap that classifies
    // as a cadence; require ALL gaps to fit the same cadence (skips records
    // that just happen to share desc+amount without a recurring rhythm).
    const gaps: number[] = []
    for (let i = 1; i < items.length; i++) {
      gaps.push(Math.round((items[i].t - items[i - 1].t) / 86_400_000))
    }
    const classifications = gaps.map(classifyCadence)
    if (classifications.some((c) => c === null)) continue
    const allSame = classifications.every((c) => c === classifications[0])
    if (!allSame) continue
    const cadence = classifications[0] as CadenceKind

    // Suggested anchor day from most-common occurrence
    const dates = items.map((i) => new Date(i.t))
    const suggestedDayOfMonth =
      cadence === 'monthly' ? modeOrFirst(dates.map((d) => d.getDate())) : null
    const suggestedDayOfWeek =
      cadence === 'weekly' ? modeOrFirst(dates.map((d) => d.getDay())) : null

    candidates.push({
      description: items[0].e.description.trim(),
      amount: items[0].e.amount,
      category: items[0].e.category,
      cadence,
      occurrences: items.length,
      dates: items.map((i) => isoDate(i.t)),
      suggestedDayOfMonth,
      suggestedDayOfWeek,
    })
  }

  // Sort: more occurrences first, larger amount as tie-break
  candidates.sort((a, b) => {
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences
    return b.amount - a.amount
  })

  return candidates
}

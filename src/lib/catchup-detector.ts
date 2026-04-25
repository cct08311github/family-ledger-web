/**
 * Detect "user has been quiet for too long" gaps that warrant a catch-up
 * nudge on the home page (Issue #288).
 *
 * The biggest data-quality failure mode for any expense tracker is "I forgot
 * to record". Surfacing the gap right after the user opens the app gives
 * them a chance to backfill while memory is fresh. The function returns
 * null when there's no gap worth nudging about (no expenses yet, or
 * recorded recently); otherwise it returns the gap size in days.
 *
 * Pure function. Caller owns dismiss state (we recommend session-only —
 * see component).
 */
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

const DEFAULT_THRESHOLD_DAYS = 4

export interface CatchupNudge {
  /** Whole days since the most recent recorded expense. */
  daysGap: number
  /** ISO YYYY-MM-DD of the most recent recorded date — for context display. */
  lastRecordedDate: string
}

interface DetectInput {
  expenses: readonly Expense[]
  /** Current time (injectable for tests). */
  now?: number
  /** Threshold in days; default 4. */
  thresholdDays?: number
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

function isoDay(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function detectCatchupNudge({
  expenses,
  now = Date.now(),
  thresholdDays = DEFAULT_THRESHOLD_DAYS,
}: DetectInput): CatchupNudge | null {
  if (expenses.length === 0) return null

  // Find the most recent valid expense date
  let mostRecent: number | null = null
  for (const e of expenses) {
    const t = safeT(e)
    if (t === null) continue
    if (mostRecent === null || t > mostRecent) mostRecent = t
  }

  if (mostRecent === null) return null

  // Day-level gap: zero out time portion of both dates so a record yesterday
  // at any time counts as "1 day gap" not partial.
  const today = new Date(now)
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const last = new Date(mostRecent)
  const lastUtc = Date.UTC(last.getFullYear(), last.getMonth(), last.getDate())
  const daysGap = Math.floor((todayUtc - lastUtc) / 86_400_000)

  if (daysGap < thresholdDays) return null

  return { daysGap, lastRecordedDate: isoDay(mostRecent) }
}

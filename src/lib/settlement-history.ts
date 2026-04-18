/**
 * Helpers for showing settlement-age context on each debt row in the split
 * page. Pure functions so the component renders from stable, testable inputs.
 * Issue #209.
 */

export interface SettlementRecord {
  fromMemberId: string
  toMemberId: string
  // Accept unknown so callers can pass raw Firestore documents (whose `date`
  // is a Timestamp) without casting. coerceDate handles the duck type.
  date: unknown
  amount: number
}

function coerceDate(d: unknown): Date | null {
  if (!d) return null
  if (d instanceof Date) {
    return Number.isFinite(d.getTime()) ? d : null
  }
  if (typeof d === 'object' && typeof (d as { toDate?: unknown }).toDate === 'function') {
    try {
      const out = (d as { toDate: () => Date }).toDate()
      return out instanceof Date && Number.isFinite(out.getTime()) ? out : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Find the most recent settlement that involves the given pair of members, in
 * either direction. Returns null when the pair has never settled or when all
 * candidate records have unparseable dates.
 *
 * Why bidirectional: the UI shows debt `A → B` (A owes B). A prior `B → A`
 * settlement (B paid A) still means these two people have reconciled recently,
 * so it counts as "they're settling regularly". A strict same-direction match
 * would hide the signal from the common case where families alternate who
 * pays whom.
 */
export function findLastSettlementBetween(
  settlements: readonly SettlementRecord[],
  memberA: string,
  memberB: string,
): { date: Date; amount: number } | null {
  if (memberA === memberB) return null
  let best: { date: Date; amount: number } | null = null
  for (const s of settlements) {
    const involves =
      (s.fromMemberId === memberA && s.toMemberId === memberB) ||
      (s.fromMemberId === memberB && s.toMemberId === memberA)
    if (!involves) continue
    const d = coerceDate(s.date)
    if (!d) continue
    if (!best || d.getTime() > best.date.getTime()) {
      best = { date: d, amount: s.amount }
    }
  }
  return best
}

// Exported so tests can reuse them when asserting boundary behaviour, and
// future tuning changes one number in one place.
export const DAY_MS = 24 * 60 * 60 * 1000
export const STALE_DAYS = 30

export interface SettlementAge {
  /** Localized phrase, e.g. "3 天前結算" / "尚未結算". */
  text: string
  /** Raw days since last settlement; null when there is none. */
  daysAgo: number | null
  /** True when daysAgo >= STALE_DAYS — UI may colour this as a nudge. */
  isStale: boolean
}

/**
 * Turn a raw last-settlement Date (or null) into a user-facing phrase plus a
 * `isStale` flag for visual emphasis. `now` is injectable so tests stay
 * deterministic without mocking the global clock.
 */
export function formatSettlementAge(date: Date | null, now: number): SettlementAge {
  if (!date) return { text: '尚未結算', daysAgo: null, isStale: false }
  // Clamp negative diffs (future dates) to 0 so clock skew / test fixtures
  // don't render "-3 天前".
  const diff = Math.max(0, now - date.getTime())
  const daysAgo = Math.floor(diff / DAY_MS)
  const isStale = daysAgo >= STALE_DAYS
  let text: string
  if (daysAgo === 0) text = '今天結算'
  else if (daysAgo === 1) text = '昨天結算'
  else text = `${daysAgo} 天前結算`
  return { text, daysAgo, isStale }
}

/**
 * Heuristic detector for "partner just recorded the same bill" duplicates.
 * Pure function — UI calls it whenever description+amount are both filled
 * in the expense form and shows a warning banner on a hit. Issue #211.
 *
 * Conservative by design: false positives annoy users more than false
 * negatives. Only flag when BOTH the amount is an exact match AND the
 * descriptions overlap meaningfully AND the candidate is inside a short
 * time window (default 5 min).
 */

export const DEFAULT_WINDOW_MINUTES = 5
// Descriptions of 1 character match too eagerly (e.g. "x") — require at
// least MIN_DESCRIPTION_LENGTH chars of signal.
const MIN_DESCRIPTION_LENGTH = 2

export interface DuplicateCandidate {
  description: string
  amount: number
  /** When editing an existing expense, pass its id so it's not a self-match. */
  isEditingId?: string
}

export interface RecentExpenseLike {
  id: string
  description: string
  amount: number
  payerName: string
  /** Firestore Timestamp or Date — coerceDate handles the duck type. */
  createdAt: unknown
}

interface Options {
  windowMinutes?: number
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

function normalise(s: string): string {
  return s.trim().toLowerCase()
}

function descriptionsOverlap(a: string, b: string): boolean {
  const na = normalise(a)
  const nb = normalise(b)
  if (!na || !nb) return false
  if (na.length < MIN_DESCRIPTION_LENGTH || nb.length < MIN_DESCRIPTION_LENGTH) return false
  // Equal or either contains the other — covers short "電費" vs verbose "電費 4月"
  return na === nb || na.includes(nb) || nb.includes(na)
}

export function findPossibleDuplicate(
  candidate: DuplicateCandidate,
  recent: readonly RecentExpenseLike[],
  now: number,
  opts: Options = {},
): RecentExpenseLike | null {
  const { description, amount, isEditingId } = candidate
  if (!description || !description.trim()) return null
  if (!amount || amount <= 0) return null

  const window = (opts.windowMinutes ?? DEFAULT_WINDOW_MINUTES) * 60_000

  let best: { record: RecentExpenseLike; at: number } | null = null
  for (const r of recent) {
    if (r.id === isEditingId) continue
    if (r.amount !== amount) continue
    if (!descriptionsOverlap(description, r.description)) continue
    const d = coerceDate(r.createdAt)
    if (!d) continue
    const at = d.getTime()
    if (now - at > window) continue
    if (!best || at > best.at) best = { record: r, at }
  }
  return best?.record ?? null
}

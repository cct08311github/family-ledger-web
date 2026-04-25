import { toDate } from './utils'
import type { Expense } from './types'

export interface HistoryEntry {
  /** Date as YYYY-MM-DD (local). */
  dateLabel: string
  /** Epoch ms — used for sort and "X days ago" calc. */
  ts: number
  amount: number
}

export interface SameDescriptionHistoryData {
  /** Most recent entries first (up to limit). */
  recentEntries: HistoryEntry[]
  /** Mean across all matched entries within window. */
  averagePrice: number
  /** Total matched entries within window. */
  count: number
  /** The single most recent entry (recentEntries[0]). */
  lastEntry: HistoryEntry
  /** Days back from now to the lastEntry occurrence (≥ 0). */
  daysSinceLast: number
}

interface FindOptions {
  description: string
  expenses: Expense[]
  /** Exclude an expense id (used when editing). */
  currentId?: string
  /** Days back to consider. Default 365 (1 year). */
  windowDays?: number
  /** Top N recent entries to surface. Default 3. */
  limit?: number
  /** Min description length before matching. Default 2. */
  minDescriptionLength?: number
  /** Now in epoch ms; defaults to Date.now(). */
  now?: number
}

function normalize(s: string): string {
  return (s ?? '').trim().toLowerCase()
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Look up prior expenses whose description matches (case-insensitive,
 * trimmed) so the form can inline a "last time you paid X for this"
 * hint. Distinct from duplicate-detector which warns about *too-similar*
 * recent entries (a defence against accidental double-record); this is
 * an *informative* anchor across longer history.
 */
export function findSameDescriptionHistory({
  description,
  expenses,
  currentId,
  windowDays = 365,
  limit = 3,
  minDescriptionLength = 2,
  now = Date.now(),
}: FindOptions): SameDescriptionHistoryData | null {
  const normalized = normalize(description)
  if (normalized.length < minDescriptionLength) return null

  const cutoff = now - windowDays * 86_400_000
  const matches: HistoryEntry[] = []
  let total = 0
  let count = 0

  for (const e of expenses) {
    if (currentId && e.id === currentId) continue
    if (normalize(e.description) !== normalized) continue
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
    matches.push({ dateLabel: dateKey(d), ts, amount })
    total += amount
    count++
  }

  if (count === 0) return null

  matches.sort((a, b) => b.ts - a.ts)
  const recentEntries = matches.slice(0, limit)
  const lastEntry = recentEntries[0]
  const daysSinceLast = Math.max(0, Math.floor((now - lastEntry.ts) / 86_400_000))

  return {
    recentEntries,
    averagePrice: total / count,
    count,
    lastEntry,
    daysSinceLast,
  }
}

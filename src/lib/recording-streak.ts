import { toDate } from './utils'
import type { Expense } from './types'

export interface RecordingStreakData {
  /** Consecutive days ending today (or yesterday if today not yet recorded) with at least one createdAt entry. */
  currentStreak: number
  /** All-time longest consecutive recording streak. */
  longestStreak: number
  /** Distinct dates within the current calendar month that have at least one createdAt entry. */
  daysRecordedThisMonth: number
  /** Number of days in the current calendar month up to (and including) today. */
  daysInMonthSoFar: number
  /** Whether today already has at least one entry. */
  recordedToday: boolean
  /** True iff currentStreak === longestStreak and currentStreak > 0 — celebrates a new record. */
  isNewRecord: boolean
  /** Date string (YYYY-MM-DD) of the most recent recording, or null if none. */
  lastRecordedDate: string | null
}

interface ComputeOptions {
  expenses: Expense[]
  /** Now in epoch ms; defaults to Date.now(). */
  now?: number
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Computes recording-consistency streak from `createdAt` (not `date`) so
 * back-filling historical expenses can't fake a streak. The streak is the
 * count of consecutive calendar days ending today (or yesterday if today
 * has no record yet) on which the user added at least one expense.
 *
 * Returns null when there's no usable data so callers can render nothing
 * gracefully.
 */
export function computeRecordingStreak({
  expenses,
  now = Date.now(),
}: ComputeOptions): RecordingStreakData | null {
  const recordedDays = new Set<string>()

  for (const e of expenses) {
    let createdAt: Date
    try {
      createdAt = toDate(e.createdAt)
    } catch {
      continue
    }
    const ts = createdAt.getTime()
    if (!Number.isFinite(ts) || ts <= 0) continue
    recordedDays.add(dateKey(createdAt))
  }

  if (recordedDays.size === 0) return null

  const today = startOfDay(new Date(now))
  const todayKey = dateKey(today)
  const recordedToday = recordedDays.has(todayKey)

  let currentStreak = 0
  const cur = new Date(today)
  if (!recordedToday) {
    cur.setDate(cur.getDate() - 1)
  }
  while (recordedDays.has(dateKey(cur))) {
    currentStreak++
    cur.setDate(cur.getDate() - 1)
  }

  const sortedKeys = Array.from(recordedDays).sort()
  let longestStreak = 0
  let runLen = 0
  let prevTs = -Infinity
  for (const k of sortedKeys) {
    const [y, m, d] = k.split('-').map(Number)
    const ts = new Date(y, m - 1, d).getTime()
    if (prevTs !== -Infinity && ts - prevTs === 86_400_000) {
      runLen++
    } else {
      runLen = 1
    }
    if (runLen > longestStreak) longestStreak = runLen
    prevTs = ts
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  let daysRecordedThisMonth = 0
  for (const k of recordedDays) {
    const [y, m] = k.split('-').map(Number)
    if (y === monthStart.getFullYear() && m - 1 === monthStart.getMonth()) {
      daysRecordedThisMonth++
    }
  }
  const daysInMonthSoFar = today.getDate()

  const isNewRecord = currentStreak > 0 && currentStreak === longestStreak

  const lastRecordedDate = sortedKeys[sortedKeys.length - 1] ?? null

  return {
    currentStreak,
    longestStreak,
    daysRecordedThisMonth,
    daysInMonthSoFar,
    recordedToday,
    isNewRecord,
    lastRecordedDate,
  }
}

/**
 * Next-occurrence helpers for the recurring-expense settings UI (Issue #250).
 *
 * Thin wrapper over getNextOccurrences — returns a single upcoming date or
 * null, and provides a relative-day label ("今天" / "明天" / "N 天後").
 * Used to surface the next scheduled auto-generation on each card without
 * waiting for the generator sweep to fire.
 */
import { getNextOccurrences } from '@/lib/recurring-occurrences'
import type { RecurringExpense } from '@/lib/types'

/** How far ahead to search for the next occurrence. 1 year covers all freqs. */
const LOOKAHEAD_MS = 366 * 24 * 60 * 60 * 1000

export function nextOccurrenceAfter(template: RecurringExpense, now: Date): Date | null {
  const end = template.endDate instanceof Date
    ? template.endDate
    : template.endDate && 'toDate' in template.endDate
      ? template.endDate.toDate()
      : null
  const searchUntil = new Date(now.getTime() + LOOKAHEAD_MS)
  const before = end && end < searchUntil ? end : searchUntil
  if (before <= now) return null
  const dates = getNextOccurrences(template, now, before)
  return dates[0] ?? null
}

/**
 * Short relative-day label for a future date relative to `now`.
 * - 0 days → "今天"
 * - 1 day → "明天"
 * - >1 → "N 天後"
 * - <0 → "N 天前" (used for lastGeneratedAt)
 */
export function relativeDaysLabel(target: Date, now: Date): string {
  const msPerDay = 86_400_000
  // Zero out time portion for day-level comparison
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((a - b) / msPerDay)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '明天'
  if (diffDays === -1) return '昨天'
  if (diffDays > 0) return `${diffDays} 天後`
  return `${Math.abs(diffDays)} 天前`
}

/** Format a Date as YYYY/M/D for compact display. */
export function formatShortDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

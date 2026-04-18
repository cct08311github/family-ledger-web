/**
 * Presentation helpers for activity log entries. Issue #201.
 * Pure functions; unit-testable without Firestore.
 */

const ACTION_ICONS: Record<string, string> = {
  expense_created: '💸',
  expense_updated: '✏️',
  expense_deleted: '🗑️',
  settlement_created: '✅',
  settlement_deleted: '↩️',
  member_added: '👤',
  member_updated: '👤',
  member_removed: '👤',
  category_created: '📂',
  category_updated: '✏️',
  category_deleted: '🗑️',
}

export function getActivityIcon(action: string): string {
  return ACTION_ICONS[action] ?? '📌'
}

/**
 * Accept either a Date, a Firestore Timestamp-like (has `toDate()`), or a
 * plain epoch millis number. The home feed is a read-only consumer so we
 * degrade silently on malformed input.
 */
type DateLike = Date | number | { toDate: () => Date } | null | undefined

function toDate(d: DateLike): Date | null {
  if (!d) return null
  if (d instanceof Date) return d
  if (typeof d === 'number') return new Date(d)
  if (typeof d === 'object' && typeof (d as { toDate?: unknown }).toDate === 'function') {
    try {
      return (d as { toDate: () => Date }).toDate()
    } catch {
      return null
    }
  }
  return null
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * Format a past timestamp as a Chinese relative-time label suitable for
 * a compact activity feed. Future timestamps are clamped to "剛剛" so
 * minor client clock skew doesn't render "-3 分鐘前".
 */
export function formatRelativeTime(when: DateLike, now: number): string {
  const d = toDate(when)
  if (!d) return ''
  const diff = now - d.getTime()
  if (diff < MINUTE_MS) return '剛剛'
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} 分鐘前`
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} 小時前`
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)} 天前`
  // Fall back to M/D; the settings page can show the full timestamp.
  return `${d.getMonth() + 1}/${d.getDate()}`
}

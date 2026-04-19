/**
 * YYYY-MM-DD date formatter pinned to Asia/Taipei timezone.
 * Extracted into a standalone module to break the circular dependency between
 * expense-diff.ts (pure utility layer) and email-notification.ts (service layer).
 *
 * Both files import from here; neither imports the other.
 */

/**
 * YYYY-MM-DD date formatter pinned to Asia/Taipei timezone.
 * Handles both native Date and Firestore Timestamp-like objects.
 * Try/catch mirrors the coerceDate pattern used elsewhere in this repo for
 * Firestore Timestamp duck-type inputs.
 *
 * Locale + timezone fixed to Asia/Taipei so all recipients (regardless of
 * where the server runs) see the expense's local date. en-CA locale gives
 * YYYY-MM-DD; pinning timezone to Asia/Taipei keeps dates stable regardless
 * of server deployment location.
 */
export function formatEmailDate(d: Date | { toDate(): Date } | null | undefined): string {
  if (!d) return ''
  let date: Date
  try {
    if (d instanceof Date) {
      date = d
    } else if (typeof (d as { toDate?: unknown }).toDate === 'function') {
      date = (d as { toDate(): Date }).toDate()
    } else {
      return ''
    }
  } catch {
    return ''
  }
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

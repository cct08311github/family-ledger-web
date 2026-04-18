/**
 * Decide where a notification click should navigate. Pure function — UI layer
 * reads the href, wraps in a <Link>, and still runs mark-read in its onClick.
 *
 * Returns `null` for types with no useful destination (e.g. the generic
 * `reminder` type or unknown future types) so the caller can fall back to a
 * plain "mark read" button instead of rendering a dead link.
 *
 * Issue #205.
 */

export interface NotificationLike {
  type: string
  entityId?: string | null
}

// Fallback destination when the underlying entity has been deleted (or never
// had an id). The activity log is the canonical audit trail, so even a
// deleted expense has a visible record there.
const DELETED_ENTITY_FALLBACK = '/settings/activity-log'

export function getNotificationHref(notif: NotificationLike): string | null {
  const { type, entityId } = notif

  // Treat whitespace-only entityId as missing. Firestore rules do not currently
  // validate entityId format, so a malicious (or buggy) writer could store ""
  // and have us produce `/expense/` which Next.js collapses to the list page —
  // not the edit page we advertise. Normalize here defensively.
  const id = typeof entityId === 'string' && entityId.trim() ? entityId : null

  switch (type) {
    case 'expense_added':
    case 'expense_updated':
      // Edit page — if no entityId, fall back to the records list so the user
      // at least lands somewhere relevant instead of seeing a dead link.
      return id
        ? `/expense/${encodeURIComponent(id)}`
        : '/records'

    case 'expense_deleted':
      // The expense doc is gone; /expense/:id would 404. Route to the audit
      // trail where the deletion is visible.
      return DELETED_ENTITY_FALLBACK

    case 'settlement_created':
    case 'settlement_deleted':
      // /split shows all debts + settlement history; entityId-level deep-link
      // is not meaningful today.
      return '/split'

    case 'member_added':
    case 'member_updated':
    case 'member_removed':
      // Forward-compatible routing — member-service.ts does NOT currently
      // emit notifications for these events (activity log only). Kept in the
      // switch so if a future PR wires up member notifications, the click
      // target is already defined.
      return '/settings'

    default:
      return null
  }
}

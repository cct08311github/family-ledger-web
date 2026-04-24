/**
 * Helper for QuickAddBar's "↺ 同上筆" shortcut (Issue #219).
 *
 * Returns the href to /expense/new with a ?duplicate=<id> param so the
 * existing full-form duplicate path pre-fills everything (description,
 * amount, category, splits, payer, isShared). Returns null when there
 * is no recent expense to copy — caller renders a disabled placeholder.
 */
export function buildDuplicateHref(lastExpenseId: string | undefined | null): string | null {
  if (!lastExpenseId) return null
  return `/expense/new?duplicate=${encodeURIComponent(lastExpenseId)}`
}

/**
 * Pure helpers for the home-page "全部確認" pending recurring expense flow.
 * Extracted from app/(auth)/page.tsx so the filter + result-summary logic is
 * testable without React render infrastructure (Issue #179).
 */

export interface PendingExpense {
  id: string
  amount: number
}

/**
 * Filter the pending list to those that are actually confirmable. Today this
 * just drops zero-amount entries (those should be cleaned up via /records, not
 * silently confirmed). Centralized so future rules (e.g. negative amounts,
 * future-dated entries) are added in one place.
 */
export function filterConfirmable<T extends PendingExpense>(pending: readonly T[]): T[] {
  return pending.filter((e) => e.amount > 0)
}

export interface ConfirmSummary {
  total: number
  ok: number
  fail: number
}

/**
 * Summarize Promise.allSettled results from parallel confirmPendingExpense calls.
 */
export function summarizeConfirmResults(
  results: readonly PromiseSettledResult<unknown>[],
): ConfirmSummary {
  const ok = results.filter((r) => r.status === 'fulfilled').length
  return { total: results.length, ok, fail: results.length - ok }
}

/**
 * Map a confirm summary to the user-facing toast args. Returns null when
 * nothing was attempted (so the caller can skip showing a toast).
 */
export function confirmToastFromSummary(
  summary: ConfirmSummary,
): { message: string; level: 'success' | 'warning' } | null {
  if (summary.total === 0) return null
  if (summary.fail === 0) {
    return { message: `已確認 ${summary.ok} 筆定期支出`, level: 'success' }
  }
  return {
    message: `已確認 ${summary.ok} 筆，${summary.fail} 筆失敗（請稍後重試）`,
    level: 'warning',
  }
}

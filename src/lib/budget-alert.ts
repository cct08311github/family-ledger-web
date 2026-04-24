/**
 * Pure decision logic for monthly budget alerts (Issue #236).
 *
 * A group's monthly budget can cross two thresholds: 80% (warning) and 100%
 * (over). We fire **one** email per threshold per month per group and record
 * it in `group.budgetAlertHistory` so later writes don't re-alert.
 *
 * 100% alerts take precedence over 80% — if somehow both fire in the same
 * tick (e.g. a big single expense jumping from 50% to 110%), the 100% one
 * is emitted and 80% is considered "subsumed". We still record 80% in
 * history so that in the unlikely event the group budget is raised later
 * back above 80% but below 100%, we don't re-alert the 80% threshold.
 */
export type BudgetAlertThreshold = 80 | 100
export type BudgetAlertHistory = Record<string, boolean>

export interface AlertDecision {
  threshold: BudgetAlertThreshold
  /** History map key that should be set to true atomically with the send. */
  historyKey: string
  /** Any other keys that should also be set (e.g. 80 gets set when 100 fires). */
  alsoMark: readonly string[]
}

/**
 * Build the canonical history key for a (year, month, threshold) combo.
 * Exported for unit tests and service-side writes.
 */
export function buildAlertHistoryKey(year: number, month: number, threshold: BudgetAlertThreshold): string {
  const mm = String(month).padStart(2, '0')
  return `${year}-${mm}-${threshold}`
}

export interface AlertInput {
  currentTotal: number
  budget: number
  history: BudgetAlertHistory | undefined
  /** Four-digit year. */
  year: number
  /** 1..12. */
  month: number
}

export function shouldTriggerAlert({
  currentTotal,
  budget,
  history,
  year,
  month,
}: AlertInput): AlertDecision | null {
  if (!Number.isFinite(budget) || budget <= 0) return null
  if (!Number.isFinite(currentTotal) || currentTotal < 0) return null

  const h = history ?? {}
  const pct = (currentTotal / budget) * 100
  const key80 = buildAlertHistoryKey(year, month, 80)
  const key100 = buildAlertHistoryKey(year, month, 100)

  if (pct >= 100 && !h[key100]) {
    // Subsume the 80 threshold by also marking it (avoids replay if budget
    // is raised later and we land back between 80 and 100 in the same month).
    return { threshold: 100, historyKey: key100, alsoMark: [key80] }
  }

  if (pct >= 80 && !h[key80]) {
    return { threshold: 80, historyKey: key80, alsoMark: [] }
  }

  return null
}

/**
 * Human-friendly email subject + body based on the decision.
 * Exported for both server-side rendering and tests.
 */
export function buildAlertMessage(
  decision: AlertDecision,
  data: { currentTotal: number; budget: number; groupName?: string },
): { title: string; body: string } {
  const fmt = (n: number) => `NT$ ${n.toLocaleString('zh-TW')}`
  if (decision.threshold === 100) {
    return {
      title: '🚨 本月支出超過預算',
      body: `本月支出 ${fmt(data.currentTotal)} 已超過 ${fmt(data.budget)} 預算。下半個月請特別留意開銷。`,
    }
  }
  return {
    title: '⚠️ 本月已達 80% 預算',
    body: `本月支出 ${fmt(data.currentTotal)} 已達 ${fmt(data.budget)} 預算的 80%。剩餘額度還有 ${fmt(data.budget - data.currentTotal)}。`,
  }
}

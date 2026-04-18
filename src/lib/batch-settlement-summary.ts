/**
 * Build a single human-readable summary string for a batched settlement
 * action, so the activity log records one row per user action (not N rows
 * for N debts closed).
 *
 * Format:
 *   - 0 items  → "批次結清（無項目）"       (defensive; caller should filter)
 *   - 1 item   → "批次結清：<from> → <to> <amount>"
 *   - 2-3      → "批次結清（共 N 筆）：<list joined by 、>"
 *   - > 3      → "批次結清（共 N 筆）：<first 3 joined>…等 N 筆"
 *
 * Pure function — injectable `formatAmount` keeps it locale-agnostic for
 * tests. Issue #196.
 */
export interface SettlementSummaryItem {
  fromMemberName: string
  toMemberName: string
  amount: number
}

const DEFAULT_AMOUNT_FORMAT = (n: number): string => `NT$ ${n.toLocaleString()}`
const MAX_INLINE = 3

export function formatBatchSettlementSummary(
  settlements: ReadonlyArray<SettlementSummaryItem>,
  formatAmount: (_n: number) => string = DEFAULT_AMOUNT_FORMAT,
): string {
  if (settlements.length === 0) return '批次結清（無項目）'

  if (settlements.length === 1) {
    const s = settlements[0]
    return `批次結清：${s.fromMemberName} → ${s.toMemberName} ${formatAmount(s.amount)}`
  }

  const shown = settlements
    .slice(0, MAX_INLINE)
    .map((s) => `${s.fromMemberName} → ${s.toMemberName} ${formatAmount(s.amount)}`)
    .join('、')

  // tail is the count of items NOT shown inline ("remaining"), not the total.
  // "列 3 筆 + …等 5 筆" would read as if 5 more existed after the 3; we want
  // "列 3 筆 + …等 2 筆" for 5 total. Issue #196 review feedback.
  const remaining = settlements.length - MAX_INLINE
  const tail = remaining > 0 ? `…等 ${remaining} 筆` : ''

  return `批次結清（共 ${settlements.length} 筆）：${shown}${tail}`
}

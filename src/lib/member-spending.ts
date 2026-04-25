/**
 * Per-member spending aggregation for the home page breakdown widget
 * (Issue #264). "Spending" here means amount the member fronted as payer
 * (matches the "X 付" UX semantic), not their share of split.
 *
 * Pure function — caller passes already-filtered expenses (typically the
 * current month). Returns rows sorted desc by amount, including 0-amount
 * members so the UI can choose to hide or grey them.
 */
import type { Expense, FamilyMember } from '@/lib/types'

export interface MemberSpendingRow {
  memberId: string
  memberName: string
  paid: number
  /** Share of the total spending (0..1). 0 when total is 0. */
  share: number
}

export function aggregateMemberSpending(
  expenses: readonly Expense[],
  members: readonly FamilyMember[],
): MemberSpendingRow[] {
  const totals = new Map<string, number>()
  for (const e of expenses) {
    if (!e.payerId) continue
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount)) continue
    totals.set(e.payerId, (totals.get(e.payerId) ?? 0) + e.amount)
  }

  const grandTotal = [...totals.values()].reduce((s, v) => s + v, 0)

  // Build rows for every member so we get stable ordering even with zero spend
  const rows: MemberSpendingRow[] = members.map((m) => {
    const paid = totals.get(m.id) ?? 0
    const share = grandTotal > 0 ? paid / grandTotal : 0
    return { memberId: m.id, memberName: m.name, paid, share }
  })

  // Append rows for payerIds that aren't in the members list (e.g. removed
  // members who still appear as historical payerName). Use payerName from any
  // expense that has it for display.
  const knownIds = new Set(members.map((m) => m.id))
  for (const e of expenses) {
    if (!e.payerId || knownIds.has(e.payerId)) continue
    knownIds.add(e.payerId)
    const paid = totals.get(e.payerId) ?? 0
    rows.push({
      memberId: e.payerId,
      memberName: e.payerName ?? e.payerId,
      paid,
      share: grandTotal > 0 ? paid / grandTotal : 0,
    })
  }

  rows.sort((a, b) => b.paid - a.paid)
  return rows
}

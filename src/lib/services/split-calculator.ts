// Shared domain: split-calculator.ts
// Business logic is extracted to @family-ledger/domain (packages/family-ledger-domain/).
// This file re-exports once Turbopack workspace support is resolved.

import type { Expense, Settlement } from '@/lib/types'

interface Debt {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

export type { Debt }

/** 計算每人淨餘額 */
export function calculateNetBalances(
  expenses: Expense[],
  settlements: Settlement[],
): Record<string, number> {
  const balances: Record<string, number> = {}

  for (const e of expenses) {
    if (!e.isShared) continue

    // 先把付款人的 paidAmount 加進去（無論是否為參與者）
    if (e.payerId) {
      const payerSplit = e.splits.find((s) => s.memberId === e.payerId)
      const paid = payerSplit?.paidAmount ?? 0
      balances[e.payerId] = (balances[e.payerId] ?? 0) + paid
    }

    // 參與者的 shareAmount 要扣除（變成欠款）
    for (const s of e.splits) {
      if (!s.isParticipant) continue
      balances[s.memberId] = (balances[s.memberId] ?? 0) - s.shareAmount
    }
  }

  for (const s of settlements) {
    balances[s.fromMemberId] = (balances[s.fromMemberId] ?? 0) - s.amount
    balances[s.toMemberId] = (balances[s.toMemberId] ?? 0) + s.amount
  }

  return balances
}

/** 貪心演算法簡化債務（最少轉帳次數） */
export function simplifyDebts(
  expenses: Expense[],
  settlements: Settlement[],
  nameMap: Record<string, string>,
): Debt[] {
  const balances = calculateNetBalances(expenses, settlements)

  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  for (const [id, amount] of Object.entries(balances)) {
    if (Math.round(amount) > 0) creditors.push({ id, amount: Math.round(amount) })
    if (Math.round(amount) < 0) debtors.push({ id, amount: -Math.round(amount) })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const result: Debt[] = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]
    const d = debtors[di]
    const amt = Math.min(c.amount, d.amount)
    if (amt > 0) {
      result.push({
        from: d.id,
        fromName: nameMap[d.id] ?? d.id,
        to: c.id,
        toName: nameMap[c.id] ?? c.id,
        amount: amt,
      })
    }
    c.amount -= amt
    d.amount -= amt
    if (Math.round(c.amount) <= 0) ci++
    if (Math.round(d.amount) <= 0) di++
  }

  return result
}

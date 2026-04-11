// Shared domain: split-calculator.ts
// Business logic is extracted to @family-ledger/domain (packages/family-ledger-domain/).
// This file re-exports once Turbopack workspace support is resolved.

import type { Expense, Settlement, SplitDetail, FamilyMember } from '@/lib/types'
import { logger } from '@/lib/logger'

interface Debt {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

export type { Debt }

/**
 * Build equal splits for a list of members.
 * Remainder goes to the LAST participant (consistent with expense-form.tsx behaviour).
 * If amount is 0 or falsy, all shareAmounts are 0.
 * Sets paidAmount for the payer to the full amount.
 */
export function buildEqualSplits(
  amount: number,
  members: FamilyMember[],
  payerId: string,
): SplitDetail[] {
  if (members.length === 0) return []
  const amt = amount || 0
  const per = members.length > 0 ? Math.round(amt / members.length) : 0
  const remainder = amt - per * members.length
  return members.map((m, i) => ({
    memberId: m.id,
    memberName: m.name,
    shareAmount: i === members.length - 1 ? per + remainder : per,
    paidAmount: m.id === payerId ? amt : 0,
    isParticipant: true,
  }))
}

/** 計算每人淨餘額 */
export function calculateNetBalances(
  expenses: Expense[],
  settlements: Settlement[],
): Record<string, number> {
  const balances: Record<string, number> = {}

  for (const e of expenses) {
    if (!e.isShared) continue

    // 加入每人實際付款金額
    let payerCredited = false
    let totalPaid = 0
    for (const s of e.splits) {
      if (s.paidAmount > 0) {
        balances[s.memberId] = (balances[s.memberId] ?? 0) + s.paidAmount
        totalPaid += s.paidAmount
        if (s.memberId === e.payerId) payerCredited = true
      }
    }
    // 付款人不在 splits 中時（例：爸爸付錢但只拆給小孩），以全額計入
    if (e.payerId && !payerCredited) {
      balances[e.payerId] = (balances[e.payerId] ?? 0) + e.amount
    }
    // Sanity check: splits 的 paidAmount 總和應等於 expense amount
    if (payerCredited && totalPaid !== e.amount) {
      logger.warn(`[split-calculator] paidAmount sum (${totalPaid}) != expense amount (${e.amount}) for "${e.description}"`)
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

  const rawCreditors: { id: string; amount: number }[] = []
  const rawDebtors: { id: string; amount: number }[] = []

  for (const [id, amount] of Object.entries(balances)) {
    if (Math.round(amount) > 0) rawCreditors.push({ id, amount: Math.round(amount) })
    if (Math.round(amount) < 0) rawDebtors.push({ id, amount: -Math.round(amount) })
  }

  rawCreditors.sort((a, b) => b.amount - a.amount)
  rawDebtors.sort((a, b) => b.amount - a.amount)

  // Clone to working copies to avoid mutating the sorted arrays
  const creditors = rawCreditors.map((c) => ({ ...c }))
  const debtors = rawDebtors.map((d) => ({ ...d }))

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
    creditors[ci] = { ...creditors[ci], amount: creditors[ci].amount - amt }
    debtors[di] = { ...debtors[di], amount: debtors[di].amount - amt }
    if (Math.round(creditors[ci].amount) <= 0) ci++
    if (Math.round(debtors[di].amount) <= 0) di++
  }

  return result
}

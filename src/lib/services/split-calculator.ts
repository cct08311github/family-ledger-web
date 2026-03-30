import type { Expense, Settlement } from '@/lib/types'

interface Debt {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

/** 計算每人淨餘額 */
export function calculateNetBalances(
  expenses: Expense[],
  settlements: Settlement[],
): Record<string, number> {
  const balances: Record<string, number> = {}

  for (const e of expenses) {
    if (!e.isShared) continue
    for (const s of e.splits) {
      if (!s.isParticipant) continue
      // 應付 - 已付 = 淨欠款
      const debt = s.shareAmount - s.paidAmount
      balances[s.memberId] = (balances[s.memberId] ?? 0) - debt
    }
  }

  // 結算扣減
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

  // 分成債權人（正）和債務人（負）
  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  for (const [id, amount] of Object.entries(balances)) {
    if (Math.round(amount) > 0) creditors.push({ id, amount })
    if (Math.round(amount) < 0) debtors.push({ id, amount: -amount })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const result: Debt[] = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]
    const d = debtors[di]
    const amount = Math.min(c.amount, d.amount)

    if (Math.round(amount) > 0) {
      result.push({
        from: d.id,
        fromName: nameMap[d.id] ?? d.id,
        to: c.id,
        toName: nameMap[c.id] ?? c.id,
        amount: Math.round(amount),
      })
    }

    c.amount -= amount
    d.amount -= amount

    if (Math.round(c.amount) <= 0) ci++
    if (Math.round(d.amount) <= 0) di++
  }

  return result
}

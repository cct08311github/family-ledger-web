import { aggregateMemberSpending } from '@/lib/member-spending'
import type { Expense, FamilyMember } from '@/lib/types'

function mkMember(id: string, name: string): FamilyMember {
  return { id, name, role: 'member', addedAt: new Date(), addedBy: 'u1' } as unknown as FamilyMember
}

function mkExpense(id: string, payerId: string, amount: number, payerName?: string): Expense {
  return {
    id,
    groupId: 'g1',
    description: 'e',
    amount,
    category: 'X',
    payerId,
    payerName: payerName ?? payerId,
    isShared: true,
    splitMethod: 'equal',
    splits: [],
    paymentMethod: 'cash',
    date: new Date(),
    createdAt: new Date(),
    createdBy: 'u1',
    receiptPaths: [],
  } as unknown as Expense
}

describe('aggregateMemberSpending', () => {
  const members: FamilyMember[] = [mkMember('m1', '爸'), mkMember('m2', '媽')]

  it('returns rows for every member when no expenses', () => {
    const rows = aggregateMemberSpending([], members)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.paid === 0)).toBe(true)
    expect(rows.every((r) => r.share === 0)).toBe(true)
  })

  it('aggregates paid amounts per payerId', () => {
    const expenses = [
      mkExpense('e1', 'm1', 100),
      mkExpense('e2', 'm1', 200),
      mkExpense('e3', 'm2', 50),
    ]
    const rows = aggregateMemberSpending(expenses, members)
    expect(rows[0]).toMatchObject({ memberId: 'm1', paid: 300 })
    expect(rows[1]).toMatchObject({ memberId: 'm2', paid: 50 })
  })

  it('sorts rows desc by paid amount', () => {
    const expenses = [mkExpense('e1', 'm1', 50), mkExpense('e2', 'm2', 100)]
    const rows = aggregateMemberSpending(expenses, members)
    expect(rows[0].memberId).toBe('m2')
    expect(rows[1].memberId).toBe('m1')
  })

  it('computes share as fraction of total', () => {
    const expenses = [mkExpense('e1', 'm1', 60), mkExpense('e2', 'm2', 40)]
    const rows = aggregateMemberSpending(expenses, members)
    const m1 = rows.find((r) => r.memberId === 'm1')!
    const m2 = rows.find((r) => r.memberId === 'm2')!
    expect(m1.share).toBeCloseTo(0.6)
    expect(m2.share).toBeCloseTo(0.4)
  })

  it('includes payerIds NOT in members list (historical removed members)', () => {
    const expenses = [
      mkExpense('e1', 'm1', 100),
      mkExpense('e2', 'ghost', 50, '已移除成員'),
    ]
    const rows = aggregateMemberSpending(expenses, members)
    const ghost = rows.find((r) => r.memberId === 'ghost')
    expect(ghost).toBeDefined()
    expect(ghost?.memberName).toBe('已移除成員')
    expect(ghost?.paid).toBe(50)
  })

  it('skips expenses with no payerId', () => {
    const expenses = [
      mkExpense('e1', 'm1', 100),
      // @ts-expect-error testing defensive guard
      mkExpense('e2', '', 50),
    ]
    const rows = aggregateMemberSpending(expenses, members)
    const total = rows.reduce((s, r) => s + r.paid, 0)
    expect(total).toBe(100)
  })

  it('skips expenses with non-finite amount', () => {
    const expenses = [
      mkExpense('e1', 'm1', 100),
      mkExpense('e2', 'm1', NaN),
      mkExpense('e3', 'm1', Infinity),
    ]
    const rows = aggregateMemberSpending(expenses, members)
    expect(rows.find((r) => r.memberId === 'm1')?.paid).toBe(100)
  })

  it('share is 0 when total is 0 even with zero-amount expenses', () => {
    const expenses = [mkExpense('e1', 'm1', 0)]
    const rows = aggregateMemberSpending(expenses, members)
    expect(rows.every((r) => r.share === 0)).toBe(true)
  })
})

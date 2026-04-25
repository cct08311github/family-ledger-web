import { topNExpenses } from '@/lib/top-expenses'
import type { Expense } from '@/lib/types'

function mk(id: string, amount: number, date: Date): Expense {
  return {
    id,
    groupId: 'g1',
    description: `e-${id}`,
    amount,
    category: 'X',
    payerId: 'm1',
    payerName: '爸',
    isShared: true,
    splitMethod: 'equal',
    splits: [],
    paymentMethod: 'cash',
    date,
    createdAt: date,
    createdBy: 'u1',
    receiptPaths: [],
  } as unknown as Expense
}

describe('topNExpenses', () => {
  it('returns empty for n=0', () => {
    expect(topNExpenses([mk('a', 100, new Date(2026, 0, 1))], 0)).toEqual([])
  })

  it('returns empty for negative n', () => {
    expect(topNExpenses([mk('a', 100, new Date())], -1)).toEqual([])
  })

  it('returns empty for empty input', () => {
    expect(topNExpenses([], 3)).toEqual([])
  })

  it('returns all when n exceeds list size', () => {
    const list = [mk('a', 100, new Date(2026, 0, 1))]
    expect(topNExpenses(list, 5)).toHaveLength(1)
  })

  it('sorts by amount desc', () => {
    const list = [
      mk('a', 50, new Date(2026, 0, 1)),
      mk('b', 200, new Date(2026, 0, 2)),
      mk('c', 100, new Date(2026, 0, 3)),
    ]
    const top = topNExpenses(list, 3)
    expect(top.map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('tie-breaks by newer date first when amounts equal', () => {
    const list = [
      mk('older', 100, new Date(2026, 0, 1)),
      mk('newer', 100, new Date(2026, 0, 5)),
      mk('mid', 100, new Date(2026, 0, 3)),
    ]
    const top = topNExpenses(list, 3)
    expect(top.map((e) => e.id)).toEqual(['newer', 'mid', 'older'])
  })

  it('skips non-finite amounts', () => {
    const list = [
      mk('a', 100, new Date(2026, 0, 1)),
      mk('nan', NaN, new Date(2026, 0, 2)),
      mk('inf', Infinity, new Date(2026, 0, 3)),
      mk('b', 50, new Date(2026, 0, 4)),
    ]
    const top = topNExpenses(list, 5)
    expect(top.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('returns exactly n when list has more', () => {
    const list = Array.from({ length: 10 }, (_, i) =>
      mk(String(i), i * 10, new Date(2026, 0, i + 1)),
    )
    expect(topNExpenses(list, 3)).toHaveLength(3)
  })

  it('handles records with bad date gracefully (sorts to bottom on tie)', () => {
    const bad = { ...mk('bad', 100, new Date()), date: 'oops' } as unknown as Expense
    const good = mk('good', 100, new Date(2026, 0, 1))
    const top = topNExpenses([bad, good], 2)
    // Both with amount=100; good has valid date (2026-01-01 = positive ts),
    // bad has t=0 → good ranks first (newer).
    expect(top[0]?.id).toBe('good')
    expect(top[1]?.id).toBe('bad')
  })
})

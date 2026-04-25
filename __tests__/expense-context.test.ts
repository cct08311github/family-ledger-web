import { buildExpenseContext } from '@/lib/expense-context'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime()

interface MkOpts {
  id?: string
  amount?: number
  description?: string
  category?: string
  daysAgo?: number
}

function mk(opts: MkOpts = {}): Expense {
  const daysAgo = opts.daysAgo ?? 0
  const d = new Date(NOW - daysAgo * 86_400_000)
  return {
    id: opts.id ?? 'e',
    groupId: 'g1',
    description: opts.description ?? 'X',
    amount: opts.amount ?? 100,
    category: opts.category ?? 'food',
    payerId: 'm1',
    payerName: '爸',
    isShared: true,
    splitMethod: 'equal',
    splits: [],
    paymentMethod: 'cash',
    date: d,
    createdAt: d,
    createdBy: 'u1',
    receiptPaths: [],
  } as unknown as Expense
}

describe('buildExpenseContext', () => {
  it('returns null when target date unreadable', () => {
    const target = { ...mk({ id: 'target' }), date: 'oops' } as unknown as Expense
    const r = buildExpenseContext({ expense: target, allExpenses: [target], now: NOW })
    expect(r).toBeNull()
  })

  it('rank=1 when target is the only expense in its month', () => {
    const target = mk({ id: 'target', amount: 100 })
    const r = buildExpenseContext({ expense: target, allExpenses: [target], now: NOW })
    expect(r!.monthRank).toBe(1)
    expect(r!.monthCount).toBe(1)
  })

  it('rank reflects position among month expenses', () => {
    const target = mk({ id: 'target', amount: 1000 })
    const others = [
      mk({ id: 'a', amount: 1500, daysAgo: 5 }), // bigger
      mk({ id: 'b', amount: 2000, daysAgo: 3 }), // bigger
      mk({ id: 'c', amount: 800, daysAgo: 7 }), // smaller
    ]
    const r = buildExpenseContext({
      expense: target,
      allExpenses: [target, ...others],
      now: NOW,
    })
    expect(r!.monthRank).toBe(3) // 2 bigger → rank 3
    expect(r!.monthCount).toBe(4)
  })

  it('rank ignores other-month expenses', () => {
    const target = mk({ id: 'target', amount: 100 })
    const others = [mk({ id: 'a', amount: 999, daysAgo: 60 })] // outside month
    const r = buildExpenseContext({
      expense: target,
      allExpenses: [target, ...others],
      now: NOW,
    })
    expect(r!.monthRank).toBe(1)
    expect(r!.monthCount).toBe(1)
  })

  it('sameDescriptionCount excludes self', () => {
    const target = mk({ id: 'target', description: '午餐', amount: 100 })
    const r = buildExpenseContext({ expense: target, allExpenses: [target], now: NOW })
    expect(r!.sameDescriptionCount).toBe(0)
  })

  it('sameDescriptionCount counts matches across history (case-insensitive)', () => {
    const target = mk({ id: 'target', description: '午餐', amount: 100 })
    const others = [
      mk({ id: 'a', description: '午餐 ', amount: 120, daysAgo: 5 }),
      mk({ id: 'b', description: 'LUNCH', amount: 80, daysAgo: 30 }), // different normalized? case → 'lunch' vs '午餐'
      mk({ id: 'c', description: '午餐', amount: 110, daysAgo: 100 }),
    ]
    const r = buildExpenseContext({
      expense: target,
      allExpenses: [target, ...others],
      now: NOW,
    })
    expect(r!.sameDescriptionCount).toBe(2) // 午餐 only, lunch is different string
    expect(r!.sameDescriptionAverage).toBe(115) // (120 + 110) / 2
  })

  it('sameDescriptionCount respects descriptionWindowDays', () => {
    const target = mk({ id: 'target', description: '午餐', amount: 100 })
    const others = [
      mk({ id: 'inside', description: '午餐', amount: 120, daysAgo: 100 }),
      mk({ id: 'outside', description: '午餐', amount: 999, daysAgo: 400 }),
    ]
    const r = buildExpenseContext({
      expense: target,
      allExpenses: [target, ...others],
      now: NOW,
      descriptionWindowDays: 365,
    })
    expect(r!.sameDescriptionCount).toBe(1)
  })

  it('sameCategoryMonthTotal excludes self and sums same-category month', () => {
    const target = mk({ id: 'target', category: 'food', amount: 100 })
    const others = [
      mk({ id: 'a', category: 'food', amount: 200, daysAgo: 3 }), // same month + cat
      mk({ id: 'b', category: 'food', amount: 150, daysAgo: 10 }), // same month + cat
      mk({ id: 'c', category: 'transport', amount: 999, daysAgo: 5 }), // diff cat
      mk({ id: 'd', category: 'food', amount: 999, daysAgo: 60 }), // diff month
    ]
    const r = buildExpenseContext({
      expense: target,
      allExpenses: [target, ...others],
      now: NOW,
    })
    expect(r!.sameCategoryMonthTotal).toBe(350)
    expect(r!.sameCategoryMonthCount).toBe(2)
  })

  it('sameCategoryMonthTotal handles empty category as 其他', () => {
    const target = { ...mk({ id: 'target', amount: 100 }), category: '' } as unknown as Expense
    const others = [
      { ...mk({ id: 'a', amount: 200, daysAgo: 3 }), category: '' } as unknown as Expense,
    ]
    const r = buildExpenseContext({
      expense: target,
      allExpenses: [target, ...others],
      now: NOW,
    })
    expect(r!.sameCategoryMonthTotal).toBe(200)
    expect(r!.sameCategoryMonthCount).toBe(1)
  })

  it('skips bad amount records', () => {
    const target = mk({ id: 'target', amount: 100 })
    const bad = mk({ id: 'bad', amount: NaN, daysAgo: 3 })
    const r = buildExpenseContext({
      expense: target,
      allExpenses: [target, bad],
      now: NOW,
    })
    expect(r!.monthCount).toBe(1) // bad excluded
  })

  it('skips bad date records (other than target)', () => {
    const target = mk({ id: 'target', amount: 100 })
    const bad = { ...mk({ id: 'bad', amount: 100 }), date: 'oops' } as unknown as Expense
    const r = buildExpenseContext({
      expense: target,
      allExpenses: [target, bad],
      now: NOW,
    })
    expect(r!.monthCount).toBe(1)
  })

  it('handles empty description gracefully (no description matches counted)', () => {
    const target = { ...mk({ id: 'target', amount: 100 }), description: '' } as unknown as Expense
    const others = [
      { ...mk({ id: 'a', amount: 200, daysAgo: 5 }), description: '' } as unknown as Expense,
    ]
    const r = buildExpenseContext({
      expense: target,
      allExpenses: [target, ...others],
      now: NOW,
    })
    expect(r!.sameDescriptionCount).toBe(0) // empty target description → no matches
  })
})

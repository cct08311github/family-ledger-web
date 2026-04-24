import { findLastExpenseByCategory, relativeDays } from '@/lib/last-category-expense'
import type { Expense } from '@/lib/types'

function mk(id: string, category: string, daysAgo: number, amount = 100): Expense {
  const now = new Date(2026, 3, 10) // 2026-04-10
  const d = new Date(now)
  d.setDate(d.getDate() - daysAgo)
  return {
    id,
    groupId: 'g1',
    description: `e-${id}`,
    amount,
    category,
    isShared: true,
    payerId: 'm1',
    payerName: '爸',
    splitMethod: 'equal',
    splits: [],
    paymentMethod: 'cash',
    date: d,
    createdAt: d,
    createdBy: 'u1',
    receiptPaths: [],
  } as unknown as Expense
}

describe('findLastExpenseByCategory', () => {
  it('returns null for empty category', () => {
    expect(findLastExpenseByCategory([mk('a', '餐飲', 1)], '')).toBeNull()
    expect(findLastExpenseByCategory([mk('a', '餐飲', 1)], null)).toBeNull()
    expect(findLastExpenseByCategory([mk('a', '餐飲', 1)], undefined)).toBeNull()
    expect(findLastExpenseByCategory([mk('a', '餐飲', 1)], '   ')).toBeNull()
  })

  it('returns null when no match', () => {
    expect(findLastExpenseByCategory([mk('a', '餐飲', 1)], '交通')).toBeNull()
  })

  it('returns the newest matching category', () => {
    const list = [
      mk('old', '餐飲', 5, 100),
      mk('newest', '餐飲', 1, 200),
      mk('mid', '餐飲', 3, 150),
    ]
    const m = findLastExpenseByCategory(list, '餐飲')
    expect(m?.expense.id).toBe('newest')
    expect(m?.expense.amount).toBe(200)
  })

  it('ignores records without a category', () => {
    const list = [mk('no-cat', '', 1), mk('match', '餐飲', 5)]
    const m = findLastExpenseByCategory(list, '餐飲')
    expect(m?.expense.id).toBe('match')
  })

  it('trims and lowercases both sides', () => {
    const m = findLastExpenseByCategory([mk('a', '餐飲 ', 1)], ' 餐飲')
    expect(m?.expense.id).toBe('a')
    // English case
    const m2 = findLastExpenseByCategory([mk('b', 'Food', 1)], 'FOOD')
    expect(m2?.expense.id).toBe('b')
  })

  it('excludes by id when editing', () => {
    const list = [mk('being-edited', '餐飲', 1, 200), mk('other', '餐飲', 3, 100)]
    const m = findLastExpenseByCategory(list, '餐飲', 'being-edited')
    expect(m?.expense.id).toBe('other')
  })

  it('returns null when only match is excluded', () => {
    const list = [mk('only', '餐飲', 1)]
    expect(findLastExpenseByCategory(list, '餐飲', 'only')).toBeNull()
  })
})

describe('relativeDays', () => {
  const NOW = new Date(2026, 3, 10)
  it.each([
    [new Date(2026, 3, 10), '今天'],
    [new Date(2026, 3, 9), '昨天'],
    [new Date(2026, 3, 3), '7 天前'],
    [new Date(2026, 3, 11), '明天'],
    [new Date(2026, 3, 15), '5 天後'],
  ])('%s → %s', (target, expected) => {
    expect(relativeDays(target, NOW)).toBe(expected)
  })
})

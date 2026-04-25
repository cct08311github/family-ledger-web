import { findSameDescriptionHistory } from '@/lib/same-description-history'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15

function mk(id: string, amount: number, description: string, daysAgo: number): Expense {
  const d = new Date(NOW - daysAgo * 86_400_000)
  return {
    id,
    groupId: 'g1',
    description,
    amount,
    category: 'X',
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

describe('findSameDescriptionHistory', () => {
  it('returns null when description too short', () => {
    expect(
      findSameDescriptionHistory({
        description: 'a',
        expenses: [mk('1', 100, 'a', 0)],
        now: NOW,
      }),
    ).toBeNull()
    expect(
      findSameDescriptionHistory({ description: '', expenses: [], now: NOW }),
    ).toBeNull()
  })

  it('returns null when no matches', () => {
    const expenses = [mk('1', 100, '午餐', 0)]
    expect(
      findSameDescriptionHistory({ description: '咖啡', expenses, now: NOW }),
    ).toBeNull()
  })

  it('matches case-insensitive normalized descriptions', () => {
    const expenses = [
      mk('1', 100, 'Lunch', 1),
      mk('2', 120, 'lunch', 2),
      mk('3', 110, 'LUNCH ', 3),
    ]
    const r = findSameDescriptionHistory({
      description: ' LuNcH ',
      expenses,
      now: NOW,
    })
    expect(r!.count).toBe(3)
    expect(r!.averagePrice).toBe(110)
  })

  it('returns recentEntries sorted desc by date', () => {
    const expenses = [
      mk('a', 100, '午餐', 5),
      mk('b', 200, '午餐', 1),
      mk('c', 300, '午餐', 10),
    ]
    const r = findSameDescriptionHistory({ description: '午餐', expenses, now: NOW })
    expect(r!.recentEntries.map((e) => e.amount)).toEqual([200, 100, 300])
  })

  it('respects limit', () => {
    const expenses = Array.from({ length: 5 }, (_, i) => mk(String(i), 100, '午餐', i + 1))
    const r = findSameDescriptionHistory({
      description: '午餐',
      expenses,
      limit: 3,
      now: NOW,
    })
    expect(r!.recentEntries.length).toBe(3)
    expect(r!.count).toBe(5)
  })

  it('lastEntry equals recentEntries[0]', () => {
    const expenses = [
      mk('a', 100, '午餐', 5),
      mk('b', 200, '午餐', 1),
    ]
    const r = findSameDescriptionHistory({ description: '午餐', expenses, now: NOW })
    expect(r!.lastEntry).toEqual(r!.recentEntries[0])
    expect(r!.lastEntry.amount).toBe(200)
  })

  it('daysSinceLast computed correctly', () => {
    const expenses = [mk('a', 100, '午餐', 7)]
    const r = findSameDescriptionHistory({ description: '午餐', expenses, now: NOW })
    expect(r!.daysSinceLast).toBe(7)
  })

  it('excludes currentId (when editing)', () => {
    const expenses = [
      mk('current', 999, '午餐', 0),
      mk('other', 100, '午餐', 5),
    ]
    const r = findSameDescriptionHistory({
      description: '午餐',
      expenses,
      currentId: 'current',
      now: NOW,
    })
    expect(r!.count).toBe(1)
    expect(r!.recentEntries[0].amount).toBe(100)
  })

  it('skips expenses outside windowDays', () => {
    const expenses = [
      mk('inside', 100, '午餐', 100),
      mk('outside', 999, '午餐', 400), // > 365 days
    ]
    const r = findSameDescriptionHistory({
      description: '午餐',
      expenses,
      windowDays: 365,
      now: NOW,
    })
    expect(r!.count).toBe(1)
    expect(r!.recentEntries[0].amount).toBe(100)
  })

  it('skips bad amount and bad date', () => {
    const bad = { ...mk('z', 100, '午餐', 0), date: 'oops' } as unknown as Expense
    const expenses = [
      mk('valid', 100, '午餐', 1),
      mk('nan', NaN, '午餐', 0),
      mk('zero', 0, '午餐', 0),
      mk('neg', -50, '午餐', 0),
      bad,
    ]
    const r = findSameDescriptionHistory({ description: '午餐', expenses, now: NOW })
    expect(r!.count).toBe(1)
  })

  it('ignores future-dated records', () => {
    const expenses = [mk('future', 999, '午餐', -10)] // 10 days in future
    expect(
      findSameDescriptionHistory({ description: '午餐', expenses, now: NOW }),
    ).toBeNull()
  })

  it('averagePrice is mean across all matches (not just shown)', () => {
    const expenses = [
      mk('a', 100, '午餐', 1),
      mk('b', 200, '午餐', 2),
      mk('c', 300, '午餐', 3),
      mk('d', 400, '午餐', 4),
      mk('e', 500, '午餐', 5),
    ]
    const r = findSameDescriptionHistory({
      description: '午餐',
      expenses,
      limit: 3,
      now: NOW,
    })
    expect(r!.averagePrice).toBe(300) // (100+200+300+400+500) / 5
    expect(r!.count).toBe(5)
    expect(r!.recentEntries.length).toBe(3) // only 3 shown
  })
})

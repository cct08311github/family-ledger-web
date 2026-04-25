import { analyzeMostFrequent } from '@/lib/most-frequent-items'
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

describe('analyzeMostFrequent', () => {
  it('returns empty array when days <= 0', () => {
    expect(analyzeMostFrequent({ expenses: [], days: 0, now: NOW })).toEqual([])
    expect(analyzeMostFrequent({ expenses: [], days: -1, now: NOW })).toEqual([])
  })

  it('returns empty when no expenses', () => {
    expect(analyzeMostFrequent({ expenses: [], now: NOW })).toEqual([])
  })

  it('aggregates by normalized description', () => {
    const expenses = [
      mk('a', 100, '午餐', 0),
      mk('b', 120, ' 午餐 ', 1), // padding
      mk('c', 110, '午餐', 2),
    ]
    const r = analyzeMostFrequent({ expenses, now: NOW })
    expect(r.length).toBe(1)
    expect(r[0].count).toBe(3)
    expect(r[0].totalAmount).toBe(330)
    expect(r[0].averagePrice).toBe(110)
  })

  it('filters items below minCount threshold', () => {
    const expenses = [
      mk('a', 100, '午餐', 0),
      mk('b', 100, '午餐', 1), // count=2, below min
      mk('c', 100, '咖啡', 0),
      mk('d', 100, '咖啡', 1),
      mk('e', 100, '咖啡', 2), // count=3, OK
    ]
    const r = analyzeMostFrequent({ expenses, now: NOW, minCount: 3 })
    expect(r.length).toBe(1)
    expect(r[0].description).toBe('咖啡')
  })

  it('sorts by count desc, then by totalAmount desc on tie', () => {
    const expenses = [
      // 午餐: 3 records, total 300
      mk('a', 100, '午餐', 0),
      mk('b', 100, '午餐', 1),
      mk('c', 100, '午餐', 2),
      // 早餐: 3 records, total 150 (tie on count, lower total)
      mk('d', 50, '早餐', 0),
      mk('e', 50, '早餐', 1),
      mk('f', 50, '早餐', 2),
      // 加油: 5 records, top
      mk('g', 1500, '加油', 0),
      mk('h', 1500, '加油', 1),
      mk('i', 1500, '加油', 2),
      mk('j', 1500, '加油', 3),
      mk('k', 1500, '加油', 4),
    ]
    const r = analyzeMostFrequent({ expenses, now: NOW })
    expect(r[0].description).toBe('加油')
    expect(r[1].description).toBe('午餐')
    expect(r[2].description).toBe('早餐')
  })

  it('respects limit', () => {
    // 6 distinct descriptions, all qualifying
    const descriptions = ['A', 'B', 'C', 'D', 'E', 'F']
    const expenses = descriptions.flatMap((desc, i) =>
      [0, 1, 2].map((d) => mk(`${desc}${d}`, 100 + i, desc, d)),
    )
    const r = analyzeMostFrequent({ expenses, now: NOW, limit: 5 })
    expect(r.length).toBe(5)
  })

  it('skips expenses outside window', () => {
    const expenses = [
      mk('a', 100, '午餐', 0),
      mk('b', 100, '午餐', 1),
      mk('c', 100, '午餐', 2),
      mk('outside', 100, '午餐', 100), // outside default 90
    ]
    const r = analyzeMostFrequent({ expenses, now: NOW, days: 90 })
    expect(r[0].count).toBe(3) // outside excluded
  })

  it('skips bad amount and bad date', () => {
    const bad = { ...mk('z', 100, '午餐', 0), date: 'oops' } as unknown as Expense
    const expenses = [
      mk('a', 100, '午餐', 0),
      mk('b', 100, '午餐', 1),
      mk('c', 100, '午餐', 2),
      mk('z2', NaN, '午餐', 0),
      mk('z3', -50, '午餐', 0),
      bad,
    ]
    const r = analyzeMostFrequent({ expenses, now: NOW })
    expect(r[0].count).toBe(3)
    expect(r[0].totalAmount).toBe(300)
  })

  it('skips records with empty description', () => {
    const expenses = [
      mk('a', 100, '', 0),
      mk('b', 100, '   ', 1),
      mk('c', 100, '咖啡', 0),
      mk('d', 100, '咖啡', 1),
      mk('e', 100, '咖啡', 2),
    ]
    const r = analyzeMostFrequent({ expenses, now: NOW })
    expect(r.length).toBe(1)
    expect(r[0].description).toBe('咖啡')
  })

  it('lastDate uses most recent occurrence', () => {
    const expenses = [
      mk('a', 100, '午餐', 5),
      mk('b', 100, '午餐', 1),
      mk('c', 100, '午餐', 10),
    ]
    const r = analyzeMostFrequent({ expenses, now: NOW })
    expect(r[0].lastDate).toBe('2026-04-14') // 1 day ago
  })

  it('preserves display from most recent occurrence', () => {
    const expenses = [
      mk('a', 100, '咖啡', 5),
      mk('b', 100, '咖啡 ', 1), // most recent — used as display
      mk('c', 100, ' 咖啡', 10),
    ]
    const r = analyzeMostFrequent({ expenses, now: NOW })
    expect(r[0].description).toBe('咖啡') // trimmed
  })

  it('case-insensitive normalization (English)', () => {
    const expenses = [
      mk('a', 100, 'Lunch', 0),
      mk('b', 100, 'lunch', 1),
      mk('c', 100, 'LUNCH', 2),
    ]
    const r = analyzeMostFrequent({ expenses, now: NOW })
    expect(r[0].count).toBe(3)
  })
})

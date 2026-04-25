import { aggregateDailyBuckets } from '@/lib/spending-heatmap'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15

function mk(id: string, amount: number, daysAgo: number): Expense {
  const d = new Date(NOW - daysAgo * 86_400_000)
  return {
    id,
    groupId: 'g1',
    description: 'e',
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

describe('aggregateDailyBuckets', () => {
  it('returns empty array when days <= 0', () => {
    expect(aggregateDailyBuckets({ expenses: [], days: 0, now: NOW })).toEqual([])
    expect(aggregateDailyBuckets({ expenses: [], days: -1, now: NOW })).toEqual([])
  })

  it('returns N buckets for the requested window', () => {
    const r = aggregateDailyBuckets({ expenses: [], days: 7, now: NOW })
    expect(r).toHaveLength(7)
    // Last bucket should be today (2026-04-15)
    expect(r[r.length - 1].date).toBe('2026-04-15')
    // First bucket should be 6 days earlier
    expect(r[0].date).toBe('2026-04-09')
  })

  it('aggregates totals by day', () => {
    const expenses = [
      mk('a', 100, 0), // today
      mk('b', 200, 0), // today
      mk('c', 50, 1), // yesterday
    ]
    const r = aggregateDailyBuckets({ expenses, days: 7, now: NOW })
    const today = r[r.length - 1]
    const yesterday = r[r.length - 2]
    expect(today.total).toBe(300)
    expect(today.count).toBe(2)
    expect(yesterday.total).toBe(50)
    expect(yesterday.count).toBe(1)
  })

  it('intensity is 1 for max bucket and proportional for others', () => {
    const expenses = [
      mk('a', 100, 0), // today: 100
      mk('b', 50, 1), // yesterday: 50
      mk('c', 25, 2), // 2 days ago: 25
    ]
    const r = aggregateDailyBuckets({ expenses, days: 5, now: NOW })
    const today = r[r.length - 1]
    const yesterday = r[r.length - 2]
    const twoAgo = r[r.length - 3]
    expect(today.intensity).toBe(1)
    expect(yesterday.intensity).toBe(0.5)
    expect(twoAgo.intensity).toBe(0.25)
    // Empty days should be 0
    expect(r[0].intensity).toBe(0)
  })

  it('all-zero window has 0 intensity for every bucket', () => {
    const r = aggregateDailyBuckets({ expenses: [], days: 7, now: NOW })
    expect(r.every((b) => b.intensity === 0)).toBe(true)
  })

  it('skips expenses outside the window', () => {
    const expenses = [
      mk('inside', 100, 0),
      mk('outside_old', 999, 30), // 30 days back, outside 7-day window
    ]
    const r = aggregateDailyBuckets({ expenses, days: 7, now: NOW })
    const totals = r.reduce((sum, b) => sum + b.total, 0)
    expect(totals).toBe(100)
  })

  it('skips records with non-finite amount', () => {
    const expenses = [mk('a', 100, 0), mk('bad', NaN, 0), mk('inf', Infinity, 0)]
    const r = aggregateDailyBuckets({ expenses, days: 1, now: NOW })
    expect(r[0].total).toBe(100)
    expect(r[0].count).toBe(1)
  })

  it('skips records with bad date', () => {
    const bad = { ...mk('a', 100, 0), date: 'oops' } as unknown as Expense
    const r = aggregateDailyBuckets({ expenses: [bad], days: 1, now: NOW })
    expect(r[0].total).toBe(0)
  })

  it('handles 30-day window without crashing', () => {
    const expenses = Array.from({ length: 30 }, (_, i) => mk(String(i), (i + 1) * 10, i))
    const r = aggregateDailyBuckets({ expenses, days: 30, now: NOW })
    expect(r).toHaveLength(30)
    // Each bucket should have positive total
    expect(r.every((b) => b.total > 0)).toBe(true)
    // Intensity in [0, 1]
    expect(r.every((b) => b.intensity >= 0 && b.intensity <= 1)).toBe(true)
  })

  it('multiple expenses on same day combine into one bucket', () => {
    const expenses = [mk('a', 100, 5), mk('b', 200, 5), mk('c', 50, 5)]
    const r = aggregateDailyBuckets({ expenses, days: 10, now: NOW })
    const dayBucket = r[r.length - 6]
    expect(dayBucket.total).toBe(350)
    expect(dayBucket.count).toBe(3)
  })
})

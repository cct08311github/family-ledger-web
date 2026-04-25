import { aggregateLifetimeStats } from '@/lib/lifetime-stats'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15, 2026

function mk(id: string, amount: number, daysAgo: number, opts: Partial<Expense> = {}): Expense {
  const d = new Date(NOW - daysAgo * 86_400_000)
  return {
    id,
    groupId: 'g1',
    description: opts.description ?? `e-${id}`,
    amount,
    category: opts.category ?? 'X',
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

describe('aggregateLifetimeStats', () => {
  it('returns null when no expenses', () => {
    expect(aggregateLifetimeStats({ expenses: [], now: NOW })).toBeNull()
  })

  it('returns null when only invalid records', () => {
    const bad = { ...mk('a', 100, 1), date: 'oops' } as unknown as Expense
    const expenses = [bad, mk('zero', 0, 1), mk('nan', NaN, 1), mk('neg', -50, 1)]
    expect(aggregateLifetimeStats({ expenses, now: NOW })).toBeNull()
  })

  it('returns null when first record < minDaysSinceFirst', () => {
    const expenses = [mk('a', 100, 5)]
    expect(
      aggregateLifetimeStats({ expenses, now: NOW, minDaysSinceFirst: 14 }),
    ).toBeNull()
  })

  it('basic stats: total count, amount, first record date', () => {
    const expenses = [
      mk('a', 100, 60),
      mk('b', 200, 30),
      mk('c', 300, 10),
    ]
    const r = aggregateLifetimeStats({ expenses, now: NOW })
    expect(r!.totalCount).toBe(3)
    expect(r!.totalAmount).toBe(600)
    expect(r!.firstRecordDate).toBe('2026-02-14') // 60 days ago
  })

  it('totalDaysSinceFirst includes today', () => {
    const expenses = [mk('a', 100, 30)]
    const r = aggregateLifetimeStats({ expenses, now: NOW })
    expect(r!.totalDaysSinceFirst).toBe(31) // 30 days back + today
  })

  it('daysRecorded counts distinct calendar days', () => {
    const expenses = [
      mk('a', 100, 30),
      mk('b', 200, 30), // same day as a
      mk('c', 300, 20),
      mk('d', 400, 10),
    ]
    const r = aggregateLifetimeStats({ expenses, now: NOW })
    expect(r!.daysRecorded).toBe(3)
  })

  it('recordingRate = daysRecorded / totalDaysSinceFirst', () => {
    const expenses = [
      mk('a', 100, 30),
      mk('b', 200, 25),
      mk('c', 300, 20),
    ]
    const r = aggregateLifetimeStats({ expenses, now: NOW })
    // 3 distinct days / 31 day span ≈ 0.0968
    expect(r!.recordingRate).toBeCloseTo(3 / 31)
  })

  it('biggestSingleExpense is largest by amount', () => {
    const expenses = [
      mk('a', 1000, 30, { description: '機票' }),
      mk('b', 8500, 20, { description: '香港機票', category: '交通' }),
      mk('c', 500, 10),
    ]
    const r = aggregateLifetimeStats({ expenses, now: NOW })
    expect(r!.biggestSingleExpense.description).toBe('香港機票')
    expect(r!.biggestSingleExpense.amount).toBe(8500)
    expect(r!.biggestSingleExpense.category).toBe('交通')
  })

  it('highestMonth finds calendar month with max total', () => {
    const expenses = [
      mk('a', 5000, 60), // Feb 2026
      mk('b', 3000, 60), // Feb 2026 → 8000
      mk('c', 4000, 30), // March 2026
      mk('d', 1000, 10), // April 2026
    ]
    const r = aggregateLifetimeStats({ expenses, now: NOW })
    expect(r!.highestMonth.label).toBe('2026-02')
    expect(r!.highestMonth.amount).toBe(8000)
  })

  it('longestStreak finds best consecutive run', () => {
    // 3 consecutive days, then gap, then 5 consecutive days
    const expenses = [
      mk('a', 100, 30),
      mk('b', 100, 29),
      mk('c', 100, 28),
      // gap at 27..21
      mk('d', 100, 20),
      mk('e', 100, 19),
      mk('f', 100, 18),
      mk('g', 100, 17),
      mk('h', 100, 16),
    ]
    const r = aggregateLifetimeStats({ expenses, now: NOW })
    expect(r!.longestStreak).toBe(5)
  })

  it('skips bad amount records but keeps valid ones', () => {
    const bad = { ...mk('bad', 100, 30), date: 'oops' } as unknown as Expense
    const expenses = [
      mk('valid', 100, 30),
      mk('nan', NaN, 30),
      mk('zero', 0, 30),
      bad,
      mk('valid2', 200, 20),
    ]
    const r = aggregateLifetimeStats({ expenses, now: NOW })
    expect(r!.totalCount).toBe(2)
    expect(r!.totalAmount).toBe(300)
  })

  it('handles empty description / category gracefully', () => {
    const e = {
      ...mk('a', 5000, 30),
      description: '',
      category: '',
    } as unknown as Expense
    const r = aggregateLifetimeStats({ expenses: [e], now: NOW })
    expect(r!.biggestSingleExpense.description).toBe('(無描述)')
    expect(r!.biggestSingleExpense.category).toBe('其他')
  })

  it('large dataset (200 expenses) does not error', () => {
    const expenses = Array.from({ length: 200 }, (_, i) =>
      mk(String(i), (i + 1) * 10, i + 1),
    )
    const r = aggregateLifetimeStats({ expenses, now: NOW })
    expect(r).not.toBeNull()
    expect(r!.totalCount).toBe(200)
  })
})

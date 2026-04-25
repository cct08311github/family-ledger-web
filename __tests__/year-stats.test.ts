import { aggregateYearStats } from '@/lib/year-stats'
import type { Expense } from '@/lib/types'

function mk(id: string, year: number, month: number, day: number, amount: number): Expense {
  const d = new Date(year, month, day)
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

describe('aggregateYearStats', () => {
  it('returns zeros for empty expense list', () => {
    const now = new Date(2026, 3, 15) // April 2026
    const r = aggregateYearStats([], 2026, now)
    expect(r).toEqual({ year: 2026, total: 0, monthsElapsed: 4, averagePerMonth: 0 })
  })

  it('aggregates totals only for the requested year', () => {
    const now = new Date(2026, 3, 15)
    const expenses = [
      mk('a', 2026, 0, 5, 1000), // Jan 2026
      mk('b', 2026, 2, 10, 2000), // Mar 2026
      mk('c', 2025, 11, 20, 500), // Dec 2025 — different year, skipped
      mk('d', 2027, 0, 1, 300), // future year, skipped
    ]
    const r = aggregateYearStats(expenses, 2026, now)
    expect(r.total).toBe(3000)
  })

  it('current year: monthsElapsed = month + 1', () => {
    expect(aggregateYearStats([], 2026, new Date(2026, 0, 15)).monthsElapsed).toBe(1) // January
    expect(aggregateYearStats([], 2026, new Date(2026, 5, 1)).monthsElapsed).toBe(6) // June
    expect(aggregateYearStats([], 2026, new Date(2026, 11, 31)).monthsElapsed).toBe(12) // December
  })

  it('past year: monthsElapsed = 12', () => {
    const r = aggregateYearStats([mk('a', 2025, 6, 1, 1200)], 2025, new Date(2026, 3, 15))
    expect(r.monthsElapsed).toBe(12)
    expect(r.total).toBe(1200)
    expect(r.averagePerMonth).toBe(100)
  })

  it('future year: monthsElapsed = 0, average = 0', () => {
    const r = aggregateYearStats([], 2027, new Date(2026, 3, 15))
    expect(r.monthsElapsed).toBe(0)
    expect(r.averagePerMonth).toBe(0)
  })

  it('rounds averagePerMonth to nearest int', () => {
    // 1000 / 3 = 333.33 → 333
    const expenses = [mk('a', 2026, 0, 1, 333), mk('b', 2026, 1, 1, 333), mk('c', 2026, 2, 1, 334)]
    const now = new Date(2026, 2, 15) // March (month index 2 → 3 elapsed)
    const r = aggregateYearStats(expenses, 2026, now)
    expect(r.total).toBe(1000)
    expect(r.monthsElapsed).toBe(3)
    expect(r.averagePerMonth).toBe(333)
  })

  it('skips records with non-finite amount', () => {
    const expenses = [
      mk('a', 2026, 0, 1, 100),
      mk('b', 2026, 1, 1, NaN),
      mk('c', 2026, 2, 1, Infinity),
    ]
    const r = aggregateYearStats(expenses, 2026, new Date(2026, 3, 15))
    expect(r.total).toBe(100)
  })

  it('skips records with unparseable date', () => {
    const bad = { ...mk('a', 2026, 0, 1, 100), date: 'oops' as unknown as Date }
    const good = mk('b', 2026, 0, 2, 200)
    const r = aggregateYearStats([bad as unknown as Expense, good], 2026, new Date(2026, 3, 15))
    expect(r.total).toBe(200)
  })
})

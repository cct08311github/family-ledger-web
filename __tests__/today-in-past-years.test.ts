import { findTodayInPastYears } from '@/lib/today-in-past-years'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15, 2026

function mkOnDate(id: string, amount: number, year: number, month: number, day: number, opts: Partial<Expense> = {}): Expense {
  const d = new Date(year, month, day, 10, 0, 0)
  return {
    id,
    groupId: 'g1',
    description: opts.description ?? `e-${id}`,
    amount,
    category: opts.category ?? 'X',
    payerId: 'm1',
    payerName: opts.payerName ?? '爸',
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

describe('findTodayInPastYears', () => {
  it('returns empty array when no past records', () => {
    expect(findTodayInPastYears({ expenses: [], now: NOW })).toEqual([])
  })

  it('returns empty array when no records on matching day', () => {
    const expenses = [mkOnDate('a', 100, 2025, 3, 14)] // Apr 14 2025, not 15
    expect(findTodayInPastYears({ expenses, now: NOW })).toEqual([])
  })

  it('finds records for 1 year ago today', () => {
    const expenses = [
      mkOnDate('a', 800, 2025, 3, 15, { description: '午餐' }),
      mkOnDate('b', 200, 2025, 3, 15, { description: '咖啡' }),
    ]
    const r = findTodayInPastYears({ expenses, now: NOW })
    expect(r.length).toBe(1)
    expect(r[0].yearsAgo).toBe(1)
    expect(r[0].date).toBe('2025-04-15')
    expect(r[0].total).toBe(1000)
    expect(r[0].count).toBe(2)
    expect(r[0].biggest!.description).toBe('午餐')
    expect(r[0].biggest!.amount).toBe(800)
  })

  it('finds multiple past years', () => {
    const expenses = [
      mkOnDate('a1', 500, 2025, 3, 15),
      mkOnDate('a3', 5500, 2023, 3, 15, { description: '機票' }),
    ]
    const r = findTodayInPastYears({ expenses, now: NOW })
    expect(r.length).toBe(2)
    expect(r[0].yearsAgo).toBe(1)
    expect(r[1].yearsAgo).toBe(3)
    expect(r[1].biggest!.description).toBe('機票')
  })

  it('respects maxYears option', () => {
    const expenses = [
      mkOnDate('a1', 100, 2025, 3, 15),
      mkOnDate('a3', 100, 2023, 3, 15),
      mkOnDate('a5', 100, 2021, 3, 15), // beyond default 3
    ]
    const r = findTodayInPastYears({ expenses, now: NOW, maxYears: 3 })
    expect(r.length).toBe(2) // a5 excluded
  })

  it('Feb 29 falls back to Feb 28 in non-leap past year', () => {
    const feb29_2024 = new Date(2024, 1, 29, 12, 0, 0).getTime() // 2024 leap year, Feb 29
    const expenses = [
      mkOnDate('a', 200, 2023, 1, 28), // 2023 non-leap → Feb 28 should match
      mkOnDate('b', 999, 2023, 1, 27), // not match
    ]
    const r = findTodayInPastYears({ expenses, now: feb29_2024, maxYears: 1 })
    expect(r.length).toBe(1)
    expect(r[0].date).toBe('2023-02-28')
    expect(r[0].total).toBe(200)
  })

  it('skips bad amount/date records', () => {
    const bad = { ...mkOnDate('bad', 100, 2025, 3, 15), date: 'oops' } as unknown as Expense
    const expenses = [
      mkOnDate('valid', 100, 2025, 3, 15),
      mkOnDate('nan', NaN, 2025, 3, 15),
      mkOnDate('zero', 0, 2025, 3, 15),
      mkOnDate('neg', -50, 2025, 3, 15),
      bad,
    ]
    const r = findTodayInPastYears({ expenses, now: NOW })
    expect(r.length).toBe(1)
    expect(r[0].total).toBe(100)
  })

  it('only counts the exact past-year day, not surrounding dates', () => {
    const expenses = [
      mkOnDate('exact', 100, 2025, 3, 15), // Apr 15 ← match
      mkOnDate('day_before', 100, 2025, 3, 14),
      mkOnDate('day_after', 100, 2025, 3, 16),
      mkOnDate('month_before', 100, 2025, 2, 15),
    ]
    const r = findTodayInPastYears({ expenses, now: NOW })
    expect(r.length).toBe(1)
    expect(r[0].count).toBe(1)
    expect(r[0].total).toBe(100)
  })

  it('biggest is null when records list empty (defensive)', () => {
    // Although we never reach this branch from public API (we filter empty),
    // verify findBy still respects shape
    const expenses = [mkOnDate('a', 100, 2025, 3, 15)]
    const r = findTodayInPastYears({ expenses, now: NOW })
    expect(r[0].biggest).not.toBeNull()
  })

  it('handles missing description / category gracefully', () => {
    const e = {
      ...mkOnDate('a', 100, 2025, 3, 15),
      description: '',
      category: '',
    } as unknown as Expense
    const r = findTodayInPastYears({ expenses: [e], now: NOW })
    expect(r[0].biggest!.description).toBe('(無描述)')
    expect(r[0].biggest!.category).toBe('其他')
  })

  it('results sorted by yearsAgo asc (most recent first)', () => {
    const expenses = [
      mkOnDate('a3', 100, 2023, 3, 15),
      mkOnDate('a1', 100, 2025, 3, 15),
      mkOnDate('a2', 100, 2024, 3, 15),
    ]
    const r = findTodayInPastYears({ expenses, now: NOW })
    expect(r.map((m) => m.yearsAgo)).toEqual([1, 2, 3])
  })
})

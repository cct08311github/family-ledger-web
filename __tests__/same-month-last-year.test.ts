import { compareSameMonthLastYear } from '@/lib/same-month-last-year'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15, 2026

function mkOnDate(id: string, amount: number, year: number, month: number, day: number, category = 'X'): Expense {
  const d = new Date(year, month, day, 10, 0, 0)
  return {
    id,
    groupId: 'g1',
    description: 'e',
    amount,
    category,
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

describe('compareSameMonthLastYear', () => {
  it('returns null when too early in month', () => {
    const day3 = new Date(2026, 3, 3, 12, 0, 0).getTime()
    expect(compareSameMonthLastYear({ expenses: [], now: day3 })).toBeNull()
  })

  it('returns null when no current month data', () => {
    const expenses = [mkOnDate('a', 1000, 2025, 3, 15)]
    expect(compareSameMonthLastYear({ expenses, now: NOW })).toBeNull()
  })

  it('returns null when no last year same month data', () => {
    const expenses = [mkOnDate('a', 1000, 2026, 3, 5)]
    expect(compareSameMonthLastYear({ expenses, now: NOW })).toBeNull()
  })

  it('computes delta and deltaPct correctly', () => {
    const expenses = [
      mkOnDate('curr', 15000, 2026, 3, 5),
      mkOnDate('ly', 12000, 2025, 3, 5),
    ]
    const r = compareSameMonthLastYear({ expenses, now: NOW })
    expect(r!.monthLabel).toBe('2026-04')
    expect(r!.lastYearLabel).toBe('2025-04')
    expect(r!.current.total).toBe(15000)
    expect(r!.lastYear.total).toBe(12000)
    expect(r!.delta).toBe(3000)
    expect(r!.deltaPct).toBeCloseTo(0.25)
  })

  it('topCategoryShift sorted by abs delta desc', () => {
    const expenses = [
      mkOnDate('a1', 11200, 2026, 3, 5, '餐飲'),
      mkOnDate('a2', 8000, 2025, 3, 5, '餐飲'),
      mkOnDate('b1', 1500, 2026, 3, 7, '交通'),
      mkOnDate('b2', 5000, 2025, 3, 7, '交通'),
    ]
    const r = compareSameMonthLastYear({ expenses, now: NOW })
    // |delta|: 交通 = 3500, 餐飲 = 3200 → 交通 first
    expect(r!.topCategoryShift[0].category).toBe('交通')
    expect(r!.topCategoryShift[0].delta).toBe(-3500)
    expect(r!.topCategoryShift[1].category).toBe('餐飲')
    expect(r!.topCategoryShift[1].delta).toBe(3200)
  })

  it('topCategoryShift filters trivial deltas', () => {
    const expenses = [
      mkOnDate('a1', 100, 2026, 3, 5, 'small'),
      mkOnDate('a2', 200, 2025, 3, 5, 'small'),
      mkOnDate('b1', 5000, 2026, 3, 7, 'big'),
      mkOnDate('b2', 2000, 2025, 3, 7, 'big'),
    ]
    const r = compareSameMonthLastYear({ expenses, now: NOW })
    expect(r!.topCategoryShift.length).toBe(1)
    expect(r!.topCategoryShift[0].category).toBe('big')
  })

  it('limits topCategoryShift to 3', () => {
    const cats = ['A', 'B', 'C', 'D', 'E']
    const expenses = cats.flatMap((c, i) => [
      mkOnDate(`curr${c}`, 5000 + i * 100, 2026, 3, 5, c),
      mkOnDate(`ly${c}`, 1000, 2025, 3, 5, c),
    ])
    const r = compareSameMonthLastYear({ expenses, now: NOW })
    expect(r!.topCategoryShift.length).toBe(3)
  })

  it('skips bad amount/date defensively', () => {
    const bad = { ...mkOnDate('bad', 100, 2026, 3, 5), date: 'oops' } as unknown as Expense
    const expenses = [
      mkOnDate('valid', 1000, 2026, 3, 5),
      mkOnDate('ly', 800, 2025, 3, 5),
      mkOnDate('zero', 0, 2026, 3, 5),
      mkOnDate('nan', NaN, 2026, 3, 5),
      bad,
    ]
    const r = compareSameMonthLastYear({ expenses, now: NOW })
    expect(r!.current.total).toBe(1000)
  })

  it('does not count current-month expenses dated past today', () => {
    const expenses = [
      mkOnDate('past', 1000, 2026, 3, 5),
      mkOnDate('future', 999, 2026, 3, 25), // April 25 — future as of April 15
      mkOnDate('ly', 800, 2025, 3, 5),
    ]
    const r = compareSameMonthLastYear({ expenses, now: NOW })
    expect(r!.current.total).toBe(1000) // future excluded
  })

  it('handles new categories (no last year baseline)', () => {
    const expenses = [
      mkOnDate('curr1', 1000, 2026, 3, 5, '醫療'), // new this year
      mkOnDate('curr2', 2000, 2026, 3, 5, '餐飲'),
      mkOnDate('ly', 1500, 2025, 3, 5, '餐飲'),
    ]
    const r = compareSameMonthLastYear({
      expenses,
      now: NOW,
      minCategoryDelta: 100,
    })
    const newCat = r!.topCategoryShift.find((s) => s.category === '醫療')
    expect(newCat!.previous).toBe(0)
    expect(newCat!.delta).toBe(1000)
    expect(newCat!.deltaPct).toBeNull() // pct undefined when prev=0
  })

  it('preserves count metric in current and last year buckets', () => {
    const expenses = [
      mkOnDate('curr1', 100, 2026, 3, 1),
      mkOnDate('curr2', 200, 2026, 3, 5),
      mkOnDate('curr3', 300, 2026, 3, 10),
      mkOnDate('ly1', 500, 2025, 3, 1),
      mkOnDate('ly2', 100, 2025, 3, 15),
    ]
    const r = compareSameMonthLastYear({ expenses, now: NOW })
    expect(r!.current.count).toBe(3)
    expect(r!.lastYear.count).toBe(2)
  })

  it('handles cross-year correctly (Jan vs Dec previous year)', () => {
    // Wait — same month, so Jan 2027 vs Jan 2026, not vs Dec 2026.
    const jan15_2027 = new Date(2027, 0, 15, 12, 0, 0).getTime()
    const expenses = [
      mkOnDate('curr', 1000, 2027, 0, 5),
      mkOnDate('lyJan', 800, 2026, 0, 5), // Jan 2026 — match
      mkOnDate('lyDec', 999, 2026, 11, 5), // Dec 2026 — should NOT match
    ]
    const r = compareSameMonthLastYear({ expenses, now: jan15_2027 })
    expect(r!.monthLabel).toBe('2027-01')
    expect(r!.lastYearLabel).toBe('2026-01')
    expect(r!.current.total).toBe(1000)
    expect(r!.lastYear.total).toBe(800)
  })
})

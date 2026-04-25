import { analyzeYearRecap } from '@/lib/year-recap'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15, 2026 — day 105 of year (non-leap)

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

describe('analyzeYearRecap', () => {
  it('returns null when too early in year (< minDaysSoFar)', () => {
    const day10 = new Date(2026, 0, 10, 12, 0, 0).getTime()
    expect(analyzeYearRecap({ expenses: [], now: day10, minDaysSoFar: 30 })).toBeNull()
  })

  it('returns null when no current-year spending', () => {
    const expenses = [mkOnDate('a', 100, 2025, 5, 15)]
    expect(analyzeYearRecap({ expenses, now: NOW })).toBeNull()
  })

  it('computes YTD total and projects annual', () => {
    const expenses = [
      mkOnDate('a', 10000, 2026, 0, 15),
      mkOnDate('b', 5000, 2026, 1, 20),
      mkOnDate('c', 8000, 2026, 3, 10),
    ]
    const r = analyzeYearRecap({ expenses, now: NOW })
    expect(r!.year).toBe(2026)
    expect(r!.ytdTotal).toBe(23000)
    expect(r!.daysSoFarInYear).toBe(105)
    expect(r!.daysInYear).toBe(365)
    expect(r!.projectedAnnual).toBeCloseTo((23000 / 105) * 365)
  })

  it('topCategory finds highest YTD category with share pct', () => {
    const expenses = [
      mkOnDate('a', 5000, 2026, 0, 15, '餐飲'),
      mkOnDate('b', 8000, 2026, 1, 20, '餐飲'),
      mkOnDate('c', 3000, 2026, 2, 10, '交通'),
    ]
    const r = analyzeYearRecap({ expenses, now: NOW })
    expect(r!.topCategory!.name).toBe('餐飲')
    expect(r!.topCategory!.amount).toBe(13000)
    expect(r!.topCategory!.pct).toBeCloseTo(13000 / 16000)
  })

  it('topMonth finds highest-spend month YTD', () => {
    const expenses = [
      mkOnDate('a', 1000, 2026, 0, 15), // Jan: 1000
      mkOnDate('b', 5000, 2026, 1, 10), // Feb: 5000
      mkOnDate('c', 1500, 2026, 1, 20), // Feb: +1500 = 6500
      mkOnDate('d', 500, 2026, 2, 5), // Mar: 500
    ]
    const r = analyzeYearRecap({ expenses, now: NOW })
    expect(r!.topMonth!.month).toBe(2) // February
    expect(r!.topMonth!.amount).toBe(6500)
  })

  it('lastYearSamePeriodTotal includes only last year up to same day-of-year', () => {
    // Day 105 = April 15.
    // Last year (2025): include up to April 15
    const expenses = [
      mkOnDate('curr', 1000, 2026, 3, 5),
      mkOnDate('lyJan', 2000, 2025, 0, 15), // Day 15 — included
      mkOnDate('lyMar', 3000, 2025, 2, 15), // Day 74 — included
      mkOnDate('lyJun', 999, 2025, 5, 15), // Day 166 — excluded
    ]
    const r = analyzeYearRecap({ expenses, now: NOW })
    // minLastYearDays default 30 — but we're counting expense rows, not days
    // lastYearSamePeriodCount is rows, not unique days. With 2 in same period it doesn't reach 30.
    // Need enough rows for comparable
    const expensesMany = [
      mkOnDate('curr', 1000, 2026, 3, 5),
      ...Array.from({ length: 30 }, (_, i) => mkOnDate(`ly${i}`, 100, 2025, 0, 15 + i)),
    ]
    const r2 = analyzeYearRecap({ expenses: expensesMany, now: NOW })
    expect(r2!.lastYearSamePeriodTotal).toBe(3000) // 30 × 100
    expect(r2!.vsLastYearSameDate).toBe(1000 - 3000)
  })

  it('lastYearSamePeriodTotal null when too few records', () => {
    const expenses = [
      mkOnDate('curr', 1000, 2026, 3, 5),
      mkOnDate('lyA', 100, 2025, 0, 15),
      mkOnDate('lyB', 100, 2025, 1, 15),
    ]
    const r = analyzeYearRecap({ expenses, now: NOW })
    expect(r!.lastYearSamePeriodTotal).toBeNull()
    expect(r!.vsLastYearSameDate).toBeNull()
  })

  it('lastYearTotal null when full year too thin', () => {
    const expenses = [
      mkOnDate('curr', 1000, 2026, 3, 5),
      mkOnDate('lyA', 100, 2025, 0, 15),
    ]
    const r = analyzeYearRecap({ expenses, now: NOW })
    expect(r!.lastYearTotal).toBeNull()
  })

  it('skips bad amount/date defensively', () => {
    const bad = { ...mkOnDate('bad', 100, 2026, 3, 5), date: 'oops' } as unknown as Expense
    const expenses = [
      mkOnDate('valid', 5000, 2026, 0, 15),
      mkOnDate('nan', NaN, 2026, 0, 15),
      mkOnDate('zero', 0, 2026, 0, 15),
      mkOnDate('neg', -100, 2026, 0, 15),
      bad,
    ]
    const r = analyzeYearRecap({ expenses, now: NOW })
    expect(r!.ytdTotal).toBe(5000)
  })

  it('handles leap year (2024 had 366 days)', () => {
    const apr15_2024 = new Date(2024, 3, 15, 12, 0, 0).getTime()
    const expenses = [mkOnDate('a', 1000, 2024, 1, 29)] // Feb 29, 2024
    const r = analyzeYearRecap({ expenses, now: apr15_2024 })
    expect(r!.daysInYear).toBe(366)
  })

  it('does not count current-year expenses past today', () => {
    const expenses = [
      mkOnDate('past', 1000, 2026, 0, 5),
      mkOnDate('future', 999, 2026, 5, 10), // June 10 (future as of April 15)
    ]
    const r = analyzeYearRecap({ expenses, now: NOW })
    expect(r!.ytdTotal).toBe(1000)
  })
})

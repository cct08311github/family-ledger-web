import { forecastCurrentMonth } from '@/lib/month-projection'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15, 2026

function mkOnDate(id: string, amount: number, year: number, month: number, day: number): Expense {
  const d = new Date(year, month, day, 10, 0, 0)
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

describe('forecastCurrentMonth', () => {
  it('returns null when fewer than minDays elapsed', () => {
    // Day 1 of April
    const dayOne = new Date(2026, 3, 1, 12, 0, 0).getTime()
    const r = forecastCurrentMonth({ expenses: [], now: dayOne, minDays: 3 })
    expect(r).toBeNull()
  })

  it('returns null when no spending in current month', () => {
    const r = forecastCurrentMonth({ expenses: [], now: NOW })
    expect(r).toBeNull()
  })

  it('linear pace projection', () => {
    // April 15 = day 15 of 30-day month. Spent 1500 so far → projected 3000.
    const expenses = [
      mkOnDate('a', 1000, 2026, 3, 1),
      mkOnDate('b', 500, 2026, 3, 10),
    ]
    const r = forecastCurrentMonth({ expenses, now: NOW })
    expect(r!.spentSoFar).toBe(1500)
    expect(r!.daysSoFar).toBe(15)
    expect(r!.daysInMonth).toBe(30)
    expect(r!.projectedTotal).toBe(3000)
  })

  it('excludes expenses outside current month from spentSoFar', () => {
    const expenses = [
      mkOnDate('curr', 1000, 2026, 3, 5), // April 5 — current
      mkOnDate('prev', 999, 2026, 2, 28), // March 28 — prior
    ]
    const r = forecastCurrentMonth({ expenses, now: NOW })
    expect(r!.spentSoFar).toBe(1000)
  })

  it('historicalAverage uses last 3 complete months', () => {
    const expenses = [
      mkOnDate('curr', 1000, 2026, 3, 5), // April (current)
      mkOnDate('mar', 3000, 2026, 2, 15), // March
      mkOnDate('feb', 2000, 2026, 1, 15), // February
      mkOnDate('jan', 1000, 2026, 0, 15), // January
      mkOnDate('dec', 999, 2025, 11, 15), // December — beyond 3-month window
    ]
    const r = forecastCurrentMonth({ expenses, now: NOW })
    // Avg of Mar/Feb/Jan = (3000 + 2000 + 1000) / 3 = 2000
    expect(r!.monthsAveraged).toBe(3)
    expect(r!.historicalAverage).toBe(2000)
    expect(r!.vsHistorical).toBe(r!.projectedTotal - 2000)
  })

  it('historicalAverage = null when no prior months have spending', () => {
    const expenses = [mkOnDate('curr', 1000, 2026, 3, 5)]
    const r = forecastCurrentMonth({ expenses, now: NOW })
    expect(r!.historicalAverage).toBeNull()
    expect(r!.monthsAveraged).toBe(0)
    expect(r!.vsHistorical).toBeNull()
  })

  it('historicalAverage averages only months that have spending', () => {
    const expenses = [
      mkOnDate('curr', 1000, 2026, 3, 5),
      mkOnDate('feb', 2000, 2026, 1, 15),
    ]
    const r = forecastCurrentMonth({ expenses, now: NOW })
    expect(r!.monthsAveraged).toBe(1)
    expect(r!.historicalAverage).toBe(2000)
  })

  it('skips bad amount/date', () => {
    const bad = { ...mkOnDate('bad', 100, 2026, 3, 5), date: 'oops' } as unknown as Expense
    const expenses = [
      mkOnDate('a', 100, 2026, 3, 5),
      mkOnDate('z', NaN, 2026, 3, 5),
      bad,
    ]
    const r = forecastCurrentMonth({ expenses, now: NOW })
    expect(r!.spentSoFar).toBe(100)
  })

  it('monthProgress reflects daysSoFar / daysInMonth', () => {
    const expenses = [mkOnDate('a', 100, 2026, 3, 1)]
    const r = forecastCurrentMonth({ expenses, now: NOW })
    expect(r!.monthProgress).toBeCloseTo(15 / 30)
  })

  it('handles end of month correctly', () => {
    const lastDay = new Date(2026, 3, 30, 23, 0, 0).getTime() // April 30
    const expenses = [mkOnDate('a', 9000, 2026, 3, 15)]
    const r = forecastCurrentMonth({ expenses, now: lastDay })
    expect(r!.daysSoFar).toBe(30)
    expect(r!.daysInMonth).toBe(30)
    expect(r!.projectedTotal).toBe(9000) // Already at full month
  })

  it('handles February (28-day month)', () => {
    // Feb 14, 2026
    const feb14 = new Date(2026, 1, 14, 12, 0, 0).getTime()
    const expenses = [mkOnDate('a', 700, 2026, 1, 7)]
    const r = forecastCurrentMonth({ expenses, now: feb14 })
    expect(r!.daysSoFar).toBe(14)
    expect(r!.daysInMonth).toBe(28)
    expect(r!.projectedTotal).toBeCloseTo((700 / 14) * 28)
  })
})

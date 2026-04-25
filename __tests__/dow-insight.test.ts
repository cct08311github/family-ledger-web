import {
  analyzeDayOfWeekPattern,
  isInsightWorthShowing,
  dowLabelTC,
} from '@/lib/dow-insight'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15, 2026 = Wednesday

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

describe('analyzeDayOfWeekPattern', () => {
  it('returns null when days <= 0', () => {
    expect(analyzeDayOfWeekPattern({ expenses: [], days: 0, now: NOW })).toBeNull()
    expect(analyzeDayOfWeekPattern({ expenses: [], days: -1, now: NOW })).toBeNull()
  })

  it('returns zero distribution for empty expenses', () => {
    const r = analyzeDayOfWeekPattern({ expenses: [], days: 60, now: NOW })
    expect(r).not.toBeNull()
    expect(r!.averages).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(r!.peakRatio).toBeNull()
    expect(r!.lowestDow).toBeNull()
    expect(r!.weekendShare).toBe(0)
    expect(r!.totalSpendingDays).toBe(0)
  })

  it('counts each weekday occurrence in 60-day window correctly (Wed-anchored)', () => {
    // April 15 (Wed) back 59 days = Feb 15 (Sun). Window = Feb 15..Apr 15 (60 days).
    // 60 / 7 = 8 weeks + 4 extra days starting Sun.
    // Sun/Mon/Tue/Wed = 9 each, Thu/Fri/Sat = 8 each.
    const r = analyzeDayOfWeekPattern({ expenses: [], days: 60, now: NOW })
    expect(r!.occurrences).toEqual([9, 9, 9, 9, 8, 8, 8])
  })

  it('aggregates spending by weekday', () => {
    const expenses = [
      mk('a', 700, 0), // Wed (today)
      mk('b', 700, 7), // Wed (last week)
      mk('c', 100, 1), // Tue (yesterday)
    ]
    const r = analyzeDayOfWeekPattern({ expenses, days: 60, now: NOW })
    expect(r!.totals[3]).toBe(1400) // Wed
    expect(r!.totals[2]).toBe(100) // Tue
    expect(r!.averages[3]).toBeCloseTo(1400 / 9)
    expect(r!.averages[2]).toBeCloseTo(100 / 9)
    expect(r!.peakDow).toBe(3)
    expect(r!.lowestDow).toBe(2)
    expect(r!.peakRatio).toBeCloseTo(14, 1) // 1400/100
  })

  it('skips records outside window', () => {
    const expenses = [mk('inside', 100, 0), mk('outside', 999, 90)]
    const r = analyzeDayOfWeekPattern({ expenses, days: 60, now: NOW })
    expect(r!.totals.reduce((s, x) => s + x, 0)).toBe(100)
  })

  it('skips records with bad amounts', () => {
    const expenses = [
      mk('ok', 100, 0),
      mk('nan', NaN, 0),
      mk('inf', Infinity, 0),
      mk('zero', 0, 0),
      mk('neg', -50, 0),
    ]
    const r = analyzeDayOfWeekPattern({ expenses, days: 60, now: NOW })
    expect(r!.totals[3]).toBe(100)
  })

  it('skips records with bad date', () => {
    const bad = { ...mk('a', 100, 0), date: 'oops' } as unknown as Expense
    const good = mk('b', 50, 0)
    const r = analyzeDayOfWeekPattern({ expenses: [bad, good], days: 60, now: NOW })
    expect(r!.totals[3]).toBe(50)
  })

  it('weekendShare counts Sat+Sun share of total', () => {
    const expenses = [
      mk('sat', 100, 4), // April 11 (Sat)
      mk('sun', 100, 3), // April 12 (Sun)
      mk('mon', 100, 2), // April 13 (Mon)
    ]
    const r = analyzeDayOfWeekPattern({ expenses, days: 60, now: NOW })
    expect(r!.totals[6]).toBe(100) // Sat
    expect(r!.totals[0]).toBe(100) // Sun
    expect(r!.totals[1]).toBe(100) // Mon
    expect(r!.weekendShare).toBeCloseTo(2 / 3)
  })

  it('combines multiple expenses on same day', () => {
    const expenses = [mk('a', 100, 5), mk('b', 200, 5), mk('c', 50, 5)]
    // 5 days ago = April 10 = Friday (dow 5)
    const r = analyzeDayOfWeekPattern({ expenses, days: 60, now: NOW })
    expect(r!.totals[5]).toBe(350)
    expect(r!.totalSpendingDays).toBe(1)
  })

  it('totalSpendingDays counts unique dates only', () => {
    const expenses = [
      mk('a', 100, 0),
      mk('b', 100, 0), // same day as a
      mk('c', 100, 1),
      mk('d', 100, 7),
    ]
    const r = analyzeDayOfWeekPattern({ expenses, days: 60, now: NOW })
    expect(r!.totalSpendingDays).toBe(3)
  })

  it('lowestDow equals peakDow when only one weekday has spending', () => {
    const expenses = [mk('a', 100, 0)] // Wed only
    const r = analyzeDayOfWeekPattern({ expenses, days: 60, now: NOW })
    expect(r!.peakDow).toBe(3)
    expect(r!.lowestDow).toBe(3)
    expect(r!.peakRatio).toBe(1)
  })
})

describe('isInsightWorthShowing', () => {
  it('rejects when not enough distinct spending days', () => {
    const r = analyzeDayOfWeekPattern({
      expenses: [mk('a', 5000, 0), mk('b', 5000, 1)],
      days: 60,
      now: NOW,
    })
    expect(isInsightWorthShowing(r!)).toBe(false) // only 2 distinct dates
  })

  it('rejects when total spend too low', () => {
    const expenses = Array.from({ length: 10 }, (_, i) => mk(String(i), 50, i))
    const r = analyzeDayOfWeekPattern({ expenses, days: 60, now: NOW })
    expect(isInsightWorthShowing(r!)).toBe(false) // total only 500
  })

  it('shows insight when peakRatio >= 1.5', () => {
    const expenses = [
      // Saturday-heavy: 5 sats × 1000, 5 weekday days × 100
      mk('s1', 1000, 4), // Sat
      mk('s2', 1000, 11), // Sat
      mk('s3', 1000, 18), // Sat
      mk('s4', 1000, 25), // Sat
      mk('s5', 1000, 32), // Sat
      mk('w1', 100, 1), // Tue
      mk('w2', 100, 2), // Mon
      mk('w3', 100, 8), // Tue
      mk('w4', 100, 9), // Mon
      mk('w5', 100, 15), // Tue
    ]
    const r = analyzeDayOfWeekPattern({ expenses, days: 60, now: NOW })
    expect(isInsightWorthShowing(r!)).toBe(true)
    expect(r!.peakRatio!).toBeGreaterThan(1.5)
  })

  it('shows insight when weekendShare >= 0.55', () => {
    // Spread across weekend + a couple weekdays, weekend dominates
    const expenses = [
      mk('s1', 800, 4), // Sat
      mk('s2', 800, 3), // Sun
      mk('s3', 800, 11), // Sat
      mk('s4', 800, 10), // Sun
      mk('w1', 100, 1), // Tue
      mk('w2', 100, 2), // Mon
    ]
    const r = analyzeDayOfWeekPattern({ expenses, days: 60, now: NOW })
    expect(r!.weekendShare).toBeGreaterThanOrEqual(0.55)
    expect(isInsightWorthShowing(r!)).toBe(true)
  })
})

describe('dowLabelTC', () => {
  it('returns Chinese weekday labels', () => {
    expect(dowLabelTC(0)).toBe('日')
    expect(dowLabelTC(1)).toBe('一')
    expect(dowLabelTC(6)).toBe('六')
    expect(dowLabelTC(99)).toBe('?')
  })
})

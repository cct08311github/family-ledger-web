import { checkWowAcceleration } from '@/lib/wow-acceleration'
import type { Expense } from '@/lib/types'

// April 15, 2026 = Wednesday → Monday is April 13
// Previous week: April 6 (Mon) - April 12 (Sun)
// Current week so far: April 13 - April 15 (3 days into week)
const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime()

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

describe('checkWowAcceleration', () => {
  it('returns null when too early in week (< minDaysIntoWeek)', () => {
    // Monday April 13, 2026 = day 1 of week → minDays default 2 → null
    const monday = new Date(2026, 3, 13, 12, 0, 0).getTime()
    const expenses = [
      mkOnDate('curr', 1500, 2026, 3, 13),
      mkOnDate('prev', 500, 2026, 3, 6),
    ]
    expect(checkWowAcceleration({ expenses, now: monday })).toBeNull()
  })

  it('returns null when previous week has no spending', () => {
    const expenses = [mkOnDate('curr', 1000, 2026, 3, 14)]
    expect(checkWowAcceleration({ expenses, now: NOW })).toBeNull()
  })

  it('returns null when current week has no spending', () => {
    const expenses = [mkOnDate('prev', 1000, 2026, 3, 8)]
    expect(checkWowAcceleration({ expenses, now: NOW })).toBeNull()
  })

  it('returns null when not accelerating (< 1.5x trigger)', () => {
    // Prev week 7000, curr 3 days = 2000 → est 4666.67, ratio = 0.67 → no fire
    const expenses = [
      mkOnDate('prev', 7000, 2026, 3, 8),
      mkOnDate('curr', 2000, 2026, 3, 14),
    ]
    expect(checkWowAcceleration({ expenses, now: NOW })).toBeNull()
  })

  it('returns mild warning at >= 1.5x', () => {
    // Prev: 1000. Curr: 750 over 3 days → est 1750, ratio 1.75 → mild
    const expenses = [
      mkOnDate('prev', 1000, 2026, 3, 8),
      mkOnDate('curr', 750, 2026, 3, 14),
    ]
    const r = checkWowAcceleration({ expenses, now: NOW })
    expect(r).not.toBeNull()
    expect(r!.severity).toBe('mild')
    expect(r!.previousWeekTotal).toBe(1000)
    expect(r!.currentWeekTotal).toBe(750)
    expect(r!.daysIntoWeek).toBe(3) // Mon, Tue, Wed
    expect(r!.estimatedFullWeek).toBeCloseTo(1750)
  })

  it('returns sharp warning at >= 2x', () => {
    // Prev 500, curr 1500 over 3 days → est 3500, ratio 7 → sharp
    const expenses = [
      mkOnDate('prev', 500, 2026, 3, 8),
      mkOnDate('curr', 1500, 2026, 3, 14),
    ]
    const r = checkWowAcceleration({ expenses, now: NOW })
    expect(r!.severity).toBe('sharp')
  })

  it('counts only Mon-Sun previous week', () => {
    // Prev Sunday April 5, prev Monday April 6
    // April 5 (Sun) is in week-before-prev — should be excluded
    const expenses = [
      mkOnDate('beforeprev', 9999, 2026, 3, 5), // April 5 Sunday — excluded
      mkOnDate('prev', 1000, 2026, 3, 8), // April 8 — prev week
      mkOnDate('curr', 750, 2026, 3, 14), // April 14 — curr week
    ]
    const r = checkWowAcceleration({ expenses, now: NOW })
    expect(r!.previousWeekTotal).toBe(1000) // 9999 excluded
  })

  it('respects custom triggerThreshold', () => {
    const expenses = [
      mkOnDate('prev', 1000, 2026, 3, 8),
      mkOnDate('curr', 500, 2026, 3, 14), // 3 days → est 1166, ratio 1.17
    ]
    expect(
      checkWowAcceleration({ expenses, now: NOW, triggerThreshold: 1.1 }),
    ).not.toBeNull()
    expect(
      checkWowAcceleration({ expenses, now: NOW, triggerThreshold: 1.2 }),
    ).toBeNull()
  })

  it('skips bad amount/date defensively', () => {
    const bad = { ...mkOnDate('bad', 100, 2026, 3, 14), date: 'oops' } as unknown as Expense
    const expenses = [
      mkOnDate('prev', 500, 2026, 3, 8),
      mkOnDate('curr', 750, 2026, 3, 14),
      mkOnDate('nan', NaN, 2026, 3, 14),
      mkOnDate('zero', 0, 2026, 3, 14),
      bad,
    ]
    const r = checkWowAcceleration({ expenses, now: NOW })
    expect(r!.currentWeekTotal).toBe(750)
  })

  it('handles Sunday as last day of week', () => {
    // April 12, 2026 = Sunday — Sunday belongs to previous-week (since Mon is week start)
    const sunday = new Date(2026, 3, 12, 12, 0, 0).getTime()
    // For sunday now: Monday of week containing Sunday = April 6
    // Previous Mon-Sun: March 30 - April 5
    const expenses = [
      mkOnDate('prev', 500, 2026, 3, 1), // April 1 (Wed) — in prev week (Mar 30-Apr 5)
      mkOnDate('curr', 1500, 2026, 3, 8), // April 8 (Wed) — in curr week (Apr 6-12)
    ]
    const r = checkWowAcceleration({ expenses, now: sunday })
    // Day 7 of week (Sunday) → daysIntoWeek = 7
    expect(r!.daysIntoWeek).toBe(7)
    expect(r!.previousWeekTotal).toBe(500)
    expect(r!.currentWeekTotal).toBe(1500)
    expect(r!.estimatedFullWeek).toBe(1500) // already full week
  })

  it('does not count expenses dated past today', () => {
    const expenses = [
      mkOnDate('prev', 1000, 2026, 3, 8),
      mkOnDate('past', 750, 2026, 3, 14),
      mkOnDate('future', 9999, 2026, 3, 17), // April 17 — future of NOW (Apr 15)
    ]
    const r = checkWowAcceleration({ expenses, now: NOW })
    expect(r!.currentWeekTotal).toBe(750) // future excluded
  })

  it('estimatedFullWeek extrapolation correct', () => {
    // 2 days into week, spent 800 → est 800/2*7 = 2800
    const tuesday = new Date(2026, 3, 14, 12, 0, 0).getTime()
    const expenses = [
      mkOnDate('prev', 1000, 2026, 3, 8),
      mkOnDate('curr', 800, 2026, 3, 14),
    ]
    const r = checkWowAcceleration({ expenses, now: tuesday })
    expect(r!.daysIntoWeek).toBe(2)
    expect(r!.estimatedFullWeek).toBe(2800)
  })
})

import { buildCumulativeMonthCurve } from '@/lib/cumulative-month-curve'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15

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

describe('buildCumulativeMonthCurve', () => {
  it('returns null when month too young (< minDays)', () => {
    const day2 = new Date(2026, 3, 2, 12, 0, 0).getTime()
    expect(
      buildCumulativeMonthCurve({
        expenses: [mkOnDate('a', 100, 2026, 3, 1)],
        year: 2026,
        month: 3,
        now: day2,
      }),
    ).toBeNull()
  })

  it('returns null when no current month data', () => {
    expect(
      buildCumulativeMonthCurve({
        expenses: [mkOnDate('a', 100, 2026, 2, 28)],
        year: 2026,
        month: 3,
        now: NOW,
      }),
    ).toBeNull()
  })

  it('returns null for future month', () => {
    expect(
      buildCumulativeMonthCurve({
        expenses: [],
        year: 2026,
        month: 5, // June
        now: NOW,
      }),
    ).toBeNull()
  })

  it('builds curve for current month up to today', () => {
    const expenses = [
      mkOnDate('a', 100, 2026, 3, 1),
      mkOnDate('b', 200, 2026, 3, 5),
      mkOnDate('c', 300, 2026, 3, 10),
    ]
    const r = buildCumulativeMonthCurve({ expenses, year: 2026, month: 3, now: NOW })
    expect(r!.todayDay).toBe(15)
    expect(r!.daysInMonth).toBe(30)
    expect(r!.current.length).toBe(15)
    // Day 1 → 100
    expect(r!.current[0]).toEqual({ day: 1, cumulative: 100 })
    // Day 5 → 100 + 200 = 300
    expect(r!.current[4]).toEqual({ day: 5, cumulative: 300 })
    // Day 10 → 300 + 300 = 600
    expect(r!.current[9]).toEqual({ day: 10, cumulative: 600 })
    expect(r!.todayCumulative).toBe(600)
  })

  it('builds previous month full curve when data exists', () => {
    const expenses = [
      mkOnDate('curr', 1000, 2026, 3, 5),
      mkOnDate('prev1', 500, 2026, 2, 10), // March 10
      mkOnDate('prev2', 800, 2026, 2, 25), // March 25
    ]
    const r = buildCumulativeMonthCurve({ expenses, year: 2026, month: 3, now: NOW })
    expect(r!.previous).not.toBeNull()
    expect(r!.previous!.length).toBe(31) // March has 31 days
    expect(r!.previous![24].cumulative).toBe(1300) // 500 + 800 by day 25
    expect(r!.previousMonthLabel).toBe('2026-03')
  })

  it('previous null when no prev month data', () => {
    const expenses = [mkOnDate('curr', 1000, 2026, 3, 5)]
    const r = buildCumulativeMonthCurve({ expenses, year: 2026, month: 3, now: NOW })
    expect(r!.previous).toBeNull()
    expect(r!.prevSameDayCumulative).toBeNull()
  })

  it('prevSameDayCumulative aligns to current todayDay (capped at prev month length)', () => {
    // Today = April 15. Prev month = March (31 days). Day 15 of March should align.
    const expenses = [
      mkOnDate('curr', 1000, 2026, 3, 5),
      ...Array.from({ length: 20 }, (_, i) => mkOnDate(`prev${i}`, 100, 2026, 2, i + 1)), // 100/day Mar 1..20
    ]
    const r = buildCumulativeMonthCurve({ expenses, year: 2026, month: 3, now: NOW })
    // March 15 cumulative: days 1..15 each 100 → 1500
    expect(r!.prevSameDayCumulative).toBe(1500)
  })

  it('prevSameDayCumulative caps when prev month shorter (Feb)', () => {
    // April has 30 days, but March has 31. Test reverse: query March (31 days), prev = Feb (28).
    // Today = March 30 → prevSameDay should cap to Feb 28
    const mar30 = new Date(2026, 2, 30, 12, 0, 0).getTime()
    const expenses = [
      mkOnDate('curr', 1000, 2026, 2, 5),
      ...Array.from({ length: 28 }, (_, i) => mkOnDate(`prev${i}`, 100, 2026, 1, i + 1)),
    ]
    const r = buildCumulativeMonthCurve({ expenses, year: 2026, month: 2, now: mar30 })
    expect(r!.todayDay).toBe(30)
    // Feb 28 cumulative = 28 * 100 = 2800
    expect(r!.prevSameDayCumulative).toBe(2800)
  })

  it('crosses year (Jan → previous Dec)', () => {
    const jan15 = new Date(2027, 0, 15, 12, 0, 0).getTime()
    const expenses = [
      mkOnDate('jan', 1000, 2027, 0, 5),
      mkOnDate('dec', 500, 2026, 11, 10),
    ]
    const r = buildCumulativeMonthCurve({ expenses, year: 2027, month: 0, now: jan15 })
    expect(r!.monthLabel).toBe('2027-01')
    expect(r!.previousMonthLabel).toBe('2026-12')
    expect(r!.previous).not.toBeNull()
  })

  it('renders past month fully (todayDay = daysInMonth)', () => {
    // Query March from April 15 perspective (past month)
    const expenses = [mkOnDate('a', 1000, 2026, 2, 15)]
    const r = buildCumulativeMonthCurve({ expenses, year: 2026, month: 2, now: NOW })
    expect(r!.todayDay).toBe(31) // capped at March's last day
    expect(r!.current.length).toBe(31)
  })

  it('skips bad amount/date defensively', () => {
    const bad = { ...mkOnDate('bad', 100, 2026, 3, 5), date: 'oops' } as unknown as Expense
    const expenses = [
      mkOnDate('valid', 100, 2026, 3, 5),
      mkOnDate('nan', NaN, 2026, 3, 5),
      mkOnDate('zero', 0, 2026, 3, 5),
      bad,
    ]
    const r = buildCumulativeMonthCurve({ expenses, year: 2026, month: 3, now: NOW })
    expect(r!.todayCumulative).toBe(100)
  })

  it('cumulative is monotonically non-decreasing', () => {
    const expenses = Array.from({ length: 10 }, (_, i) =>
      mkOnDate(String(i), 100, 2026, 3, i + 1),
    )
    const r = buildCumulativeMonthCurve({ expenses, year: 2026, month: 3, now: NOW })
    for (let i = 1; i < r!.current.length; i++) {
      expect(r!.current[i].cumulative).toBeGreaterThanOrEqual(r!.current[i - 1].cumulative)
    }
  })
})

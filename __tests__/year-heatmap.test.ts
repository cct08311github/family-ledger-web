import { buildYearHeatmap } from '@/lib/year-heatmap'
import type { Expense } from '@/lib/types'

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

describe('buildYearHeatmap', () => {
  it('returns null when year is non-finite', () => {
    expect(buildYearHeatmap({ expenses: [], year: NaN })).toBeNull()
  })

  it('produces 365 cells for non-leap year', () => {
    const r = buildYearHeatmap({ expenses: [], year: 2026 })
    expect(r!.cells.length).toBe(365)
  })

  it('produces 366 cells for leap year', () => {
    const r = buildYearHeatmap({ expenses: [], year: 2024 })
    expect(r!.cells.length).toBe(366)
  })

  it('all-zero year has zero intensity everywhere', () => {
    const r = buildYearHeatmap({ expenses: [], year: 2026 })
    expect(r!.yearTotal).toBe(0)
    expect(r!.yearMax).toBe(0)
    expect(r!.daysWithSpend).toBe(0)
    expect(r!.cells.every((c) => c.intensity === 0)).toBe(true)
  })

  it('aggregates daily totals and computes intensity vs yearMax', () => {
    const expenses = [
      mkOnDate('a', 100, 2026, 0, 5), // Jan 5
      mkOnDate('b', 100, 2026, 0, 5), // same day → 200 total
      mkOnDate('c', 50, 2026, 0, 6), // Jan 6
    ]
    const r = buildYearHeatmap({ expenses, year: 2026 })
    expect(r!.yearMax).toBe(200) // Jan 5
    expect(r!.yearTotal).toBe(250)
    expect(r!.daysWithSpend).toBe(2)
    const jan5 = r!.cells.find((c) => c.date === '2026-01-05')!
    const jan6 = r!.cells.find((c) => c.date === '2026-01-06')!
    expect(jan5.amount).toBe(200)
    expect(jan5.intensity).toBe(1)
    expect(jan6.amount).toBe(50)
    expect(jan6.intensity).toBeCloseTo(0.25)
  })

  it('cells are dow-correct (Jan 1 2026 = Thursday, dow=4)', () => {
    const r = buildYearHeatmap({ expenses: [], year: 2026 })
    expect(r!.cells[0].date).toBe('2026-01-01')
    expect(r!.cells[0].dow).toBe(4)
  })

  it('weekIndex starts at 0 for first week', () => {
    const r = buildYearHeatmap({ expenses: [], year: 2026 })
    // Jan 1, 2026 = Thursday (dow=4), so partial first week
    expect(r!.cells[0].weekIndex).toBe(0)
    // Saturday Jan 3 = end of week 0
    const jan3 = r!.cells.find((c) => c.date === '2026-01-03')!
    expect(jan3.weekIndex).toBe(0)
    // Sunday Jan 4 = start of week 1
    const jan4 = r!.cells.find((c) => c.date === '2026-01-04')!
    expect(jan4.weekIndex).toBe(1)
  })

  it('weeksCount reflects last weekIndex + 1', () => {
    const r = buildYearHeatmap({ expenses: [], year: 2026 })
    expect(r!.weeksCount).toBe(r!.cells[r!.cells.length - 1].weekIndex + 1)
  })

  it('skips expenses outside the year', () => {
    const expenses = [
      mkOnDate('this', 100, 2026, 5, 10), // June 2026
      mkOnDate('past', 999, 2025, 5, 10), // June 2025 — excluded
      mkOnDate('future', 999, 2027, 5, 10), // 2027 — excluded
    ]
    const r = buildYearHeatmap({ expenses, year: 2026 })
    expect(r!.yearTotal).toBe(100)
  })

  it('skips bad amount and date records', () => {
    const bad = { ...mkOnDate('bad', 100, 2026, 0, 1), date: 'oops' } as unknown as Expense
    const expenses = [
      mkOnDate('good', 100, 2026, 0, 1),
      mkOnDate('nan', NaN, 2026, 0, 1),
      mkOnDate('zero', 0, 2026, 0, 1),
      mkOnDate('neg', -50, 2026, 0, 1),
      bad,
    ]
    const r = buildYearHeatmap({ expenses, year: 2026 })
    expect(r!.yearTotal).toBe(100)
  })

  it('cells span every calendar day in chronological order', () => {
    const r = buildYearHeatmap({ expenses: [], year: 2026 })
    const firstDate = r!.cells[0].date
    const lastDate = r!.cells[r!.cells.length - 1].date
    expect(firstDate).toBe('2026-01-01')
    expect(lastDate).toBe('2026-12-31')
  })

  it('handles year 2024 leap correctly (Feb 29 present)', () => {
    const r = buildYearHeatmap({ expenses: [], year: 2024 })
    const feb29 = r!.cells.find((c) => c.date === '2024-02-29')
    expect(feb29).toBeDefined()
  })
})

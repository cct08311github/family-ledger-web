import { analyzeCategoryMoM } from '@/lib/category-mom'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15

function mk(id: string, amount: number, category: string, year: number, month: number, day: number): Expense {
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

describe('analyzeCategoryMoM', () => {
  it('returns null when too early in month', () => {
    const day3 = new Date(2026, 3, 3, 12, 0, 0).getTime()
    const r = analyzeCategoryMoM({ expenses: [], now: day3 })
    expect(r).toBeNull()
  })

  it('returns null when both months have no spending', () => {
    const r = analyzeCategoryMoM({ expenses: [], now: NOW })
    expect(r).toBeNull()
  })

  it('detects categories that grew significantly', () => {
    const expenses = [
      mk('a', 8000, '餐飲', 2026, 2, 15), // March 餐飲: 8000
      mk('b', 11000, '餐飲', 2026, 3, 5), // April 餐飲: 11000 (+38%)
    ]
    const r = analyzeCategoryMoM({ expenses, now: NOW })
    expect(r!.changes.length).toBe(1)
    expect(r!.changes[0].category).toBe('餐飲')
    expect(r!.changes[0].kind).toBe('grew')
    expect(r!.changes[0].current).toBe(11000)
    expect(r!.changes[0].previous).toBe(8000)
    expect(r!.changes[0].deltaAmount).toBe(3000)
    expect(r!.changes[0].deltaPct!).toBeCloseTo(3000 / 8000)
  })

  it('detects categories that shrank significantly', () => {
    const expenses = [
      mk('a', 5000, '交通', 2026, 2, 15), // March
      mk('b', 1500, '交通', 2026, 3, 5), // April -70%
    ]
    const r = analyzeCategoryMoM({ expenses, now: NOW })
    expect(r!.changes[0].kind).toBe('shrank')
    expect(r!.changes[0].deltaAmount).toBe(-3500)
    expect(r!.changes[0].deltaPct!).toBeCloseTo(-0.7)
  })

  it('detects new categories (previous = 0)', () => {
    const expenses = [
      mk('a', 1500, '醫療', 2026, 3, 5), // April only
    ]
    const r = analyzeCategoryMoM({ expenses, now: NOW })
    expect(r!.changes[0].kind).toBe('new')
    expect(r!.changes[0].previous).toBe(0)
    expect(r!.changes[0].deltaPct).toBeNull()
  })

  it('detects gone categories (current = 0)', () => {
    const expenses = [
      mk('a', 2000, '娛樂', 2026, 2, 15), // March only
      mk('b', 100, '其他', 2026, 3, 5), // April keep total non-zero
    ]
    const r = analyzeCategoryMoM({ expenses, now: NOW })
    const gone = r!.changes.find((c) => c.kind === 'gone')
    expect(gone).toBeDefined()
    expect(gone!.category).toBe('娛樂')
    expect(gone!.current).toBe(0)
  })

  it('filters out trivial absolute changes', () => {
    const expenses = [
      mk('a', 100, '小', 2026, 2, 15),
      mk('b', 200, '小', 2026, 3, 5), // delta=100 below threshold
    ]
    const r = analyzeCategoryMoM({ expenses, now: NOW })
    expect(r!.changes.length).toBe(0)
  })

  it('filters out small percentage changes', () => {
    const expenses = [
      mk('a', 10000, 'X', 2026, 2, 15),
      mk('b', 11000, 'X', 2026, 3, 5), // +10% but |delta|=1000 OK
    ]
    const r = analyzeCategoryMoM({ expenses, now: NOW, minDeltaPct: 0.3 })
    expect(r!.changes.length).toBe(0) // pct too small
  })

  it('sorts changes by absolute deltaAmount descending', () => {
    const expenses = [
      mk('a', 1000, 'A', 2026, 2, 15),
      mk('b', 5000, 'A', 2026, 3, 5), // delta=4000 (grew)
      mk('c', 8000, 'B', 2026, 2, 15),
      mk('d', 1000, 'B', 2026, 3, 5), // delta=-7000 (shrank)
    ]
    const r = analyzeCategoryMoM({ expenses, now: NOW })
    expect(r!.changes[0].category).toBe('B') // -7000 > 4000 in absolute
    expect(r!.changes[1].category).toBe('A')
  })

  it('skips expenses outside both months', () => {
    const expenses = [
      mk('a', 1000, 'X', 2026, 0, 15), // January — irrelevant
      mk('b', 2000, 'X', 2026, 3, 5), // April
    ]
    const r = analyzeCategoryMoM({ expenses, now: NOW })
    expect(r!.changes[0].kind).toBe('new')
    expect(r!.changes[0].previous).toBe(0)
  })

  it('handles bad amount and date defensively', () => {
    const bad = { ...mk('z', 100, 'X', 2026, 3, 5), date: 'oops' } as unknown as Expense
    const expenses = [
      mk('a', 100, 'X', 2026, 3, 5),
      mk('z2', NaN, 'X', 2026, 3, 5),
      bad,
    ]
    const r = analyzeCategoryMoM({ expenses, now: NOW })
    // Only valid expense (100) — below threshold for significant change, but still computed
    expect(r).not.toBeNull()
  })

  it('treats missing/empty category as 其他', () => {
    const a = { ...mk('a', 5000, '', 2026, 2, 15) } as unknown as Expense
    const b = { ...mk('b', 100, '', 2026, 3, 5) } as unknown as Expense
    const r = analyzeCategoryMoM({ expenses: [a, b], now: NOW })
    expect(r!.changes[0].category).toBe('其他')
    expect(r!.changes[0].kind).toBe('shrank')
  })

  it('crosses year boundary (Jan vs Dec previous year)', () => {
    const jan10 = new Date(2027, 0, 10, 12, 0, 0).getTime()
    const expenses = [
      mk('a', 5000, '餐飲', 2026, 11, 15), // Dec 2026
      mk('b', 8000, '餐飲', 2027, 0, 5), // Jan 2027 +60%
    ]
    const r = analyzeCategoryMoM({ expenses, now: jan10 })
    expect(r!.currentMonthLabel).toBe('2027-01')
    expect(r!.previousMonthLabel).toBe('2026-12')
    expect(r!.changes[0].kind).toBe('grew')
  })
})

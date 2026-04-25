import { analyzeBiggestExpense } from '@/lib/biggest-expense-spotlight'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15

function mk(id: string, amount: number, daysAgo: number, opts: Partial<Expense> = {}): Expense {
  const d = new Date(NOW - daysAgo * 86_400_000)
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

describe('analyzeBiggestExpense', () => {
  it('returns null when too early in month', () => {
    const day3 = new Date(2026, 3, 3, 12, 0, 0).getTime()
    expect(analyzeBiggestExpense({ expenses: [], now: day3 })).toBeNull()
  })

  it('returns null when no current-month expenses', () => {
    const expenses = [mk('a', 100, 60)] // March
    expect(analyzeBiggestExpense({ expenses, now: NOW })).toBeNull()
  })

  it('finds biggest expense of current month', () => {
    const expenses = [
      mk('small', 100, 5),
      mk('big', 3500, 2, { description: '機票', category: '交通' }),
      mk('mid', 1200, 8),
    ]
    const r = analyzeBiggestExpense({ expenses, now: NOW })
    expect(r!.biggest.id).toBe('big')
    expect(r!.biggest.description).toBe('機票')
    expect(r!.biggest.amount).toBe(3500)
    expect(r!.biggest.category).toBe('交通')
  })

  it('monthTop contains top N expenses sorted desc', () => {
    const expenses = [
      mk('a', 100, 1),
      mk('b', 5000, 2),
      mk('c', 200, 3),
      mk('d', 1000, 4),
      mk('e', 3000, 5),
    ]
    const r = analyzeBiggestExpense({ expenses, now: NOW })
    expect(r!.monthTop.map((e) => e.amount)).toEqual([5000, 3000, 1000])
  })

  it('respects custom topN', () => {
    const expenses = [
      mk('a', 100, 1),
      mk('b', 200, 2),
      mk('c', 300, 3),
      mk('d', 400, 4),
      mk('e', 500, 5),
    ]
    const r = analyzeBiggestExpense({ expenses, now: NOW, topN: 5 })
    expect(r!.monthTop.length).toBe(5)
  })

  it('pctile null when historical sample too thin', () => {
    const expenses = [
      mk('a', 5000, 5), // current month biggest
      ...[1, 2, 3].map((i) => mk(`h${i}`, 100, 60 + i * 5)), // 3 historical
    ]
    const r = analyzeBiggestExpense({ expenses, now: NOW, minHistoricalCount: 10 })
    expect(r!.pctile).toBeNull()
    expect(r!.historicalCount).toBe(3)
  })

  it('pctile computed when enough history', () => {
    const expenses = [
      mk('big', 5000, 5),
      // 10 historical amounts, all < 5000
      ...Array.from({ length: 10 }, (_, i) => mk(`h${i}`, 100 + i * 100, 60 + i)),
    ]
    const r = analyzeBiggestExpense({ expenses, now: NOW, minHistoricalCount: 10 })
    expect(r!.pctile).toBe(1) // 5000 ≥ all historical
    expect(r!.historicalCount).toBe(10)
  })

  it('pctile reflects relative rank correctly', () => {
    // 10 historical amounts: 100..1000 (step 100). Biggest current = 500.
    // Number ≤ 500: 5 (100,200,300,400,500) → pctile = 0.5
    const expenses = [
      mk('big', 500, 5),
      ...Array.from({ length: 10 }, (_, i) => mk(`h${i}`, (i + 1) * 100, 60 + i)),
    ]
    const r = analyzeBiggestExpense({ expenses, now: NOW, minHistoricalCount: 10 })
    expect(r!.pctile).toBe(0.5)
  })

  it('historical only includes last N months', () => {
    const expenses = [
      mk('curr', 1000, 5),
      // 10 within 6 months
      ...Array.from({ length: 10 }, (_, i) => mk(`h${i}`, 500, 60 + i * 5)),
      // 1 outside 6 months (200 days ago — definitely > 6 months)
      mk('old', 999, 200),
    ]
    const r = analyzeBiggestExpense({ expenses, now: NOW, historicalMonths: 6 })
    expect(r!.historicalCount).toBe(10) // old excluded
  })

  it('skips bad amount and date', () => {
    const bad = { ...mk('bad', 100, 5), date: 'oops' } as unknown as Expense
    const expenses = [
      mk('valid', 1000, 5),
      mk('nan', NaN, 5),
      mk('zero', 0, 5),
      mk('neg', -100, 5),
      bad,
    ]
    const r = analyzeBiggestExpense({ expenses, now: NOW })
    expect(r!.biggest.amount).toBe(1000)
  })

  it('handles missing description / category / payerName gracefully', () => {
    const e = {
      ...mk('a', 1000, 5),
      description: '',
      category: '',
      payerName: '',
    } as unknown as Expense
    const r = analyzeBiggestExpense({ expenses: [e], now: NOW })
    expect(r!.biggest.description).toBe('(無描述)')
    expect(r!.biggest.category).toBe('其他')
    expect(r!.biggest.payerName).toBe('?')
  })
})

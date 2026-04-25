import { generateMonthlyReport } from '@/lib/monthly-report'
import type { Expense } from '@/lib/types'

function mk(id: string, amount: number, year: number, month: number, day: number, opts: Partial<Expense> = {}): Expense {
  const d = new Date(year, month, day, 10, 0, 0)
  return {
    id,
    groupId: 'g1',
    description: opts.description ?? `e-${id}`,
    amount,
    category: opts.category ?? 'X',
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

describe('generateMonthlyReport', () => {
  it('returns empty when no data for month', () => {
    const r = generateMonthlyReport({ expenses: [], year: 2026, month: 3 })
    expect(r.hasData).toBe(false)
    expect(r.text).toBe('')
  })

  it('generates basic report with total + count', () => {
    const expenses = [
      mk('a', 1000, 2026, 3, 5),
      mk('b', 2000, 2026, 3, 15),
    ]
    const r = generateMonthlyReport({ expenses, year: 2026, month: 3 })
    expect(r.hasData).toBe(true)
    expect(r.total).toBe(3000)
    expect(r.count).toBe(2)
    expect(r.text).toContain('2026/04 家計月報')
    expect(r.text).toContain('NT$3,000')
    expect(r.text).toContain('2 筆')
  })

  it('includes prev month delta when supplied (positive)', () => {
    const expenses = [mk('a', 12000, 2026, 3, 5)]
    const r = generateMonthlyReport({
      expenses,
      year: 2026,
      month: 3,
      previousMonthTotal: 10000,
    })
    expect(r.text).toContain('📈')
    expect(r.text).toContain('+20%')
    expect(r.text).toContain('NT$2,000')
  })

  it('includes prev month delta when supplied (negative)', () => {
    const expenses = [mk('a', 8000, 2026, 3, 5)]
    const r = generateMonthlyReport({
      expenses,
      year: 2026,
      month: 3,
      previousMonthTotal: 10000,
    })
    expect(r.text).toContain('📉')
    expect(r.text).toContain('-20%')
  })

  it('handles previousMonthTotal === 0 gracefully (no delta line)', () => {
    const expenses = [mk('a', 1000, 2026, 3, 5)]
    const r = generateMonthlyReport({
      expenses,
      year: 2026,
      month: 3,
      previousMonthTotal: 0,
    })
    expect(r.text).not.toContain('📈')
    expect(r.text).not.toContain('📉')
  })

  it('biggest expense surfaces description', () => {
    const expenses = [
      mk('a', 100, 2026, 3, 5, { description: '咖啡' }),
      mk('big', 5500, 2026, 3, 10, { description: '香港機票' }),
      mk('c', 200, 2026, 3, 15, { description: '午餐' }),
    ]
    const r = generateMonthlyReport({ expenses, year: 2026, month: 3 })
    expect(r.text).toContain('🏆')
    expect(r.text).toContain('香港機票')
    expect(r.text).toContain('NT$5,500')
  })

  it('top 3 categories sorted by amount', () => {
    const expenses = [
      mk('a', 5000, 2026, 3, 5, { category: '餐飲' }),
      mk('b', 3000, 2026, 3, 6, { category: '交通' }),
      mk('c', 2000, 2026, 3, 7, { category: '日用品' }),
      mk('d', 100, 2026, 3, 8, { category: '其他' }),
    ]
    const r = generateMonthlyReport({ expenses, year: 2026, month: 3 })
    const lines = r.text.split('\n')
    const catLines = lines.filter((l) => /^[123]\./.test(l))
    expect(catLines.length).toBe(3)
    expect(catLines[0]).toContain('餐飲')
    expect(catLines[1]).toContain('交通')
    expect(catLines[2]).toContain('日用品')
  })

  it('skips other-month expenses', () => {
    const expenses = [
      mk('curr', 1000, 2026, 3, 5),
      mk('mar', 9999, 2026, 2, 28),
      mk('may', 9999, 2026, 4, 1),
    ]
    const r = generateMonthlyReport({ expenses, year: 2026, month: 3 })
    expect(r.total).toBe(1000)
  })

  it('skips bad amount/date defensively', () => {
    const bad = { ...mk('bad', 100, 2026, 3, 5), date: 'oops' } as unknown as Expense
    const expenses = [
      mk('valid', 100, 2026, 3, 5),
      mk('nan', NaN, 2026, 3, 5),
      mk('zero', 0, 2026, 3, 5),
      mk('neg', -50, 2026, 3, 5),
      bad,
    ]
    const r = generateMonthlyReport({ expenses, year: 2026, month: 3 })
    expect(r.count).toBe(1)
  })

  it('handles empty description / category fallback', () => {
    const e = {
      ...mk('a', 1000, 2026, 3, 5),
      description: '',
      category: '',
    } as unknown as Expense
    const r = generateMonthlyReport({ expenses: [e], year: 2026, month: 3 })
    expect(r.text).toContain('(無描述)')
    expect(r.text).toContain('其他')
  })

  it('formatted month label uses zero-padded MM', () => {
    const expenses = [mk('a', 100, 2026, 0, 5)] // January
    const r = generateMonthlyReport({ expenses, year: 2026, month: 0 })
    expect(r.text).toContain('2026/01')
  })

  it('text is multi-line with line separators', () => {
    const expenses = [mk('a', 1000, 2026, 3, 5)]
    const r = generateMonthlyReport({ expenses, year: 2026, month: 3 })
    expect(r.text).toContain('\n')
    expect(r.text.split('\n').length).toBeGreaterThan(3)
  })
})

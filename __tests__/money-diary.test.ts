import { extractDiaryFacts, composeDiarySentences } from '@/lib/money-diary'
import type { Expense } from '@/lib/types'

function mk(
  id: string,
  amount: number,
  category: string,
  date: Date,
  payerName = '爸',
  description?: string,
): Expense {
  return {
    id,
    groupId: 'g1',
    description: description ?? `desc-${id}`,
    amount,
    category,
    payerId: 'm1',
    payerName,
    isShared: true,
    splitMethod: 'equal',
    splits: [],
    paymentMethod: 'cash',
    date,
    createdAt: date,
    createdBy: 'u1',
    receiptPaths: [],
  } as unknown as Expense
}

describe('extractDiaryFacts', () => {
  it('returns zero-state for empty month', () => {
    const f = extractDiaryFacts({ monthExpenses: [], earlierExpenses: [], previousMonthTotal: null })
    expect(f.totals.current).toBe(0)
    expect(f.totals.deltaPct).toBeNull()
    expect(f.largest).toBeNull()
    expect(f.topByCount).toBeNull()
    expect(f.newCategories).toEqual([])
    expect(f.busiestDay).toBeNull()
    expect(f.expenseCount).toBe(0)
  })

  it('computes total and delta vs previous month', () => {
    const expenses = [mk('a', 100, '餐飲', new Date(2026, 3, 5))]
    const f = extractDiaryFacts({
      monthExpenses: expenses,
      earlierExpenses: [],
      previousMonthTotal: 200,
    })
    expect(f.totals.current).toBe(100)
    expect(f.totals.previous).toBe(200)
    expect(f.totals.deltaPct).toBe(-50)
  })

  it('delta null when previous month is 0 (no useful comparison)', () => {
    const expenses = [mk('a', 100, '餐飲', new Date(2026, 3, 5))]
    const f = extractDiaryFacts({
      monthExpenses: expenses,
      earlierExpenses: [],
      previousMonthTotal: 0,
    })
    expect(f.totals.deltaPct).toBeNull()
  })

  it('finds the single largest expense', () => {
    const expenses = [
      mk('a', 100, '餐飲', new Date(2026, 3, 1)),
      mk('big', 5000, '購物', new Date(2026, 3, 15)),
      mk('b', 200, '交通', new Date(2026, 3, 10)),
    ]
    const f = extractDiaryFacts({ monthExpenses: expenses, earlierExpenses: [], previousMonthTotal: null })
    expect(f.largest?.id).toBe('big')
  })

  it('detects top-by-count category', () => {
    const expenses = [
      mk('a', 100, '餐飲', new Date(2026, 3, 1)),
      mk('b', 100, '餐飲', new Date(2026, 3, 2)),
      mk('c', 100, '餐飲', new Date(2026, 3, 3)),
      mk('d', 500, '購物', new Date(2026, 3, 4)),
    ]
    const f = extractDiaryFacts({ monthExpenses: expenses, earlierExpenses: [], previousMonthTotal: null })
    expect(f.topByCount?.category).toBe('餐飲')
    expect(f.topByCount?.count).toBe(3)
    expect(f.topByCount?.total).toBe(300)
  })

  it('detects new categories that appeared this month but not before', () => {
    const earlier = [mk('e1', 100, '餐飲', new Date(2026, 2, 1))]
    const monthExpenses = [
      mk('a', 100, '餐飲', new Date(2026, 3, 1)), // existing
      mk('b', 12000, '子女教育', new Date(2026, 3, 5)), // new
      mk('c', 300, '其他', new Date(2026, 3, 10)), // new
    ]
    const f = extractDiaryFacts({ monthExpenses, earlierExpenses: earlier, previousMonthTotal: null })
    const newNames = f.newCategories.map((c) => c.category)
    expect(newNames).toContain('子女教育')
    expect(newNames).toContain('其他')
    expect(newNames).not.toContain('餐飲')
    // Sorted desc by total
    expect(f.newCategories[0].category).toBe('子女教育')
  })

  it('finds busiest day by total', () => {
    const expenses = [
      mk('a', 100, 'X', new Date(2026, 3, 1)),
      mk('b', 200, 'X', new Date(2026, 3, 5)),
      mk('c', 300, 'X', new Date(2026, 3, 5)), // same day → total 500
      mk('d', 400, 'X', new Date(2026, 3, 10)),
    ]
    const f = extractDiaryFacts({ monthExpenses: expenses, earlierExpenses: [], previousMonthTotal: null })
    expect(f.busiestDay?.dateKey).toBe('2026/4/5')
    expect(f.busiestDay?.total).toBe(500)
    expect(f.busiestDay?.count).toBe(2)
  })

  it('skips records with non-finite amount in all calculations', () => {
    const expenses = [
      mk('a', 100, 'X', new Date(2026, 3, 1)),
      mk('bad', NaN, 'X', new Date(2026, 3, 2)),
    ]
    const f = extractDiaryFacts({ monthExpenses: expenses, earlierExpenses: [], previousMonthTotal: null })
    expect(f.totals.current).toBe(100)
    expect(f.expenseCount).toBe(1)
  })

  it('expenseCount only counts finite-amount records', () => {
    const expenses = [
      mk('a', 100, 'X', new Date(2026, 3, 1)),
      mk('b', 200, 'X', new Date(2026, 3, 2)),
      mk('bad', Infinity, 'X', new Date(2026, 3, 3)),
    ]
    const f = extractDiaryFacts({ monthExpenses: expenses, earlierExpenses: [], previousMonthTotal: null })
    expect(f.expenseCount).toBe(2)
  })
})

describe('composeDiarySentences', () => {
  const month = { year: 2026, month: 3 } // April

  it('returns empty array when no expenses', () => {
    const facts = extractDiaryFacts({ monthExpenses: [], earlierExpenses: [], previousMonthTotal: null })
    expect(composeDiarySentences(facts, month)).toEqual([])
  })

  it('omits delta sentence when previous month null', () => {
    const facts = extractDiaryFacts({
      monthExpenses: [mk('a', 100, 'X', new Date(2026, 3, 1))],
      earlierExpenses: [],
      previousMonthTotal: null,
    })
    const lines = composeDiarySentences(facts, month)
    // First sentence should mention total but not "vs 上月"
    expect(lines[0]).toContain('100')
    expect(lines[0]).not.toContain('比上月')
  })

  it('reports persistent total when delta is 0%', () => {
    const facts = extractDiaryFacts({
      monthExpenses: [mk('a', 100, 'X', new Date(2026, 3, 1))],
      earlierExpenses: [],
      previousMonthTotal: 100,
    })
    const lines = composeDiarySentences(facts, month)
    expect(lines[0]).toContain('持平')
  })

  it('mentions delta direction when non-zero', () => {
    const facts = extractDiaryFacts({
      monthExpenses: [mk('a', 200, 'X', new Date(2026, 3, 1))],
      earlierExpenses: [],
      previousMonthTotal: 100,
    })
    const lines = composeDiarySentences(facts, month)
    expect(lines[0]).toContain('多花 100%')
  })

  it('skips top-by-count sentence when count < 2', () => {
    const facts = extractDiaryFacts({
      monthExpenses: [mk('a', 100, '餐飲', new Date(2026, 3, 1))],
      earlierExpenses: [],
      previousMonthTotal: null,
    })
    const lines = composeDiarySentences(facts, month)
    expect(lines.find((l) => l.includes('最頻繁'))).toBeUndefined()
  })

  it('produces multi-paragraph diary for rich month', () => {
    const expenses = [
      mk('a', 100, '餐飲', new Date(2026, 3, 1), '爸', '早餐'),
      mk('b', 100, '餐飲', new Date(2026, 3, 2), '媽', '午餐'),
      mk('c', 100, '餐飲', new Date(2026, 3, 3), '爸', '晚餐'),
      mk('big', 5000, '購物', new Date(2026, 3, 15), '媽', '家樂福'),
      mk('new', 12000, '子女教育', new Date(2026, 3, 5), '爸', '學費'),
    ]
    const facts = extractDiaryFacts({
      monthExpenses: expenses,
      earlierExpenses: [],
      previousMonthTotal: 10000,
    })
    const lines = composeDiarySentences(facts, month)
    expect(lines.length).toBeGreaterThanOrEqual(3)
    // 12000 學費 is largest — should appear in 最大一筆 sentence
    expect(lines.join('\n')).toContain('學費')
    // 餐飲 has 3 entries — top-by-count sentence
    expect(lines.join('\n')).toContain('餐飲')
    // 子女教育 is one of the new categories
    expect(lines.join('\n')).toContain('子女教育')
    // Delta sentence
    expect(lines.join('\n')).toContain('比上月')
  })

  it('mentions only top 2 new categories when there are many', () => {
    const monthExpenses = [
      mk('a', 100, 'A', new Date(2026, 3, 1)),
      mk('b', 200, 'B', new Date(2026, 3, 2)),
      mk('c', 300, 'C', new Date(2026, 3, 3)),
    ]
    const facts = extractDiaryFacts({
      monthExpenses,
      earlierExpenses: [],
      previousMonthTotal: null,
    })
    const lines = composeDiarySentences(facts, month)
    const newCatLine = lines.find((l) => l.includes('第一次出現'))
    expect(newCatLine).toBeTruthy()
    // Should pick C and B (top 2 by total) — not A
    expect(newCatLine).toContain('C')
    expect(newCatLine).toContain('B')
    expect(newCatLine).not.toContain('「A」') // 排除 A 出現在引號內
  })
})

import { sortCategoriesByFrequency } from '@/lib/category-order'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime()

function mk(id: string, daysAgo: number, category: string): Expense {
  const d = new Date(NOW - daysAgo * 86_400_000)
  return {
    id,
    groupId: 'g1',
    description: 'e',
    amount: 100,
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

describe('sortCategoriesByFrequency', () => {
  it('returns empty array for empty categories', () => {
    expect(sortCategoriesByFrequency({ categories: [], expenses: [], now: NOW })).toEqual([])
  })

  it('preserves original order when no expenses', () => {
    const r = sortCategoriesByFrequency({
      categories: ['餐飲', '交通', '購物'],
      expenses: [],
      now: NOW,
    })
    expect(r).toEqual(['餐飲', '交通', '購物'])
  })

  it('sorts by count desc', () => {
    const expenses = [
      ...Array.from({ length: 10 }, (_, i) => mk(`a${i}`, i, '交通')),
      ...Array.from({ length: 5 }, (_, i) => mk(`b${i}`, i, '餐飲')),
      ...Array.from({ length: 2 }, (_, i) => mk(`c${i}`, i, '購物')),
    ]
    const r = sortCategoriesByFrequency({
      categories: ['餐飲', '交通', '購物'],
      expenses,
      now: NOW,
    })
    expect(r).toEqual(['交通', '餐飲', '購物'])
  })

  it('preserves original order for ties', () => {
    const expenses = [
      mk('a', 0, '餐飲'),
      mk('b', 0, '交通'),
      mk('c', 0, '購物'),
    ]
    const r = sortCategoriesByFrequency({
      categories: ['購物', '餐飲', '交通'],
      expenses,
      now: NOW,
    })
    // All 1 count → keep original ['購物', '餐飲', '交通']
    expect(r).toEqual(['購物', '餐飲', '交通'])
  })

  it('unused categories sort to end (preserving relative order)', () => {
    const expenses = Array.from({ length: 5 }, (_, i) => mk(`a${i}`, i, '交通'))
    const r = sortCategoriesByFrequency({
      categories: ['餐飲', '交通', '購物'],
      expenses,
      now: NOW,
    })
    // 交通 first, then 餐飲, 購物 (both unused, original order)
    expect(r).toEqual(['交通', '餐飲', '購物'])
  })

  it('does not mutate input arrays', () => {
    const cats = ['餐飲', '交通']
    const exps = [mk('a', 0, '交通')]
    const original = cats.slice()
    sortCategoriesByFrequency({ categories: cats, expenses: exps, now: NOW })
    expect(cats).toEqual(original)
  })

  it('respects days window', () => {
    const expenses = [
      mk('recent', 5, '餐飲'),
      mk('old', 60, '交通'), // outside default 30 days
    ]
    const r = sortCategoriesByFrequency({
      categories: ['餐飲', '交通'],
      expenses,
      days: 30,
      now: NOW,
    })
    expect(r[0]).toBe('餐飲')
  })

  it('skips bad amount/date', () => {
    const bad = { ...mk('bad', 1, '交通'), date: 'oops' } as unknown as Expense
    const expenses = [
      mk('a', 1, '餐飲'),
      mk('b', 1, '餐飲'),
      mk('c', 1, '交通'),
      mk('zero', 1, '交通'),
      bad,
    ]
    // Adjust: bad date → excluded; zero amount → check
    const expensesAdjusted = [
      mk('a', 1, '餐飲'),
      mk('b', 1, '餐飲'),
      mk('c', 1, '交通'),
      { ...mk('zero', 1, '交通'), amount: 0 } as unknown as Expense,
      bad,
    ]
    const r = sortCategoriesByFrequency({
      categories: ['餐飲', '交通'],
      expenses: expensesAdjusted,
      now: NOW,
    })
    expect(r).toEqual(['餐飲', '交通']) // 餐飲=2, 交通=1 (bad+zero excluded)
  })

  it('skips empty category strings', () => {
    const expenses = [
      mk('a', 1, '餐飲'),
      mk('b', 1, ''),
      mk('c', 1, '   '),
    ]
    const r = sortCategoriesByFrequency({
      categories: ['餐飲', '交通'],
      expenses,
      now: NOW,
    })
    expect(r[0]).toBe('餐飲') // empty/whitespace not counted
  })

  it('counts expenses not amount totals', () => {
    // 1 expense @ 5000 vs 5 expenses @ 100 → 5 wins
    const expenses = [
      { ...mk('big', 0, '餐飲'), amount: 5000 } as unknown as Expense,
      ...Array.from({ length: 5 }, (_, i) => mk(`small${i}`, i, '交通')),
    ]
    const r = sortCategoriesByFrequency({
      categories: ['餐飲', '交通'],
      expenses,
      now: NOW,
    })
    expect(r[0]).toBe('交通') // 5 count > 1 count
  })

  it('handles future-dated expenses (excludes them)', () => {
    const expenses = [
      mk('past', 5, '餐飲'),
      mk('future', -10, '交通'), // future
    ]
    const r = sortCategoriesByFrequency({
      categories: ['餐飲', '交通'],
      expenses,
      now: NOW,
    })
    expect(r[0]).toBe('餐飲')
  })

  it('handles category names with extra whitespace', () => {
    const expenses = [
      mk('a', 1, '餐飲 '), // trailing space
      mk('b', 1, ' 餐飲'), // leading space
    ]
    const r = sortCategoriesByFrequency({
      categories: ['餐飲', '交通'],
      expenses,
      now: NOW,
    })
    expect(r[0]).toBe('餐飲') // trim normalizes
  })
})

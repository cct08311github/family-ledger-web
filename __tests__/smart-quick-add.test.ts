import { suggestNextExpense } from '@/lib/smart-quick-add'
import type { Expense } from '@/lib/types'

// April 15, 2026 = Wednesday (dow 3) at 12:00
const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime()

interface MkOpts {
  id: string
  amount: number
  description: string
  daysAgo: number
  hour?: number
  category?: string
}

function mk(opts: MkOpts): Expense {
  const d = new Date(NOW - opts.daysAgo * 86_400_000)
  d.setHours(opts.hour ?? 12, 0, 0, 0)
  return {
    id: opts.id,
    groupId: 'g1',
    description: opts.description,
    amount: opts.amount,
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

describe('suggestNextExpense', () => {
  it('returns null when no expenses', () => {
    expect(suggestNextExpense({ expenses: [], now: NOW })).toBeNull()
  })

  it('returns null when no matching dow expenses', () => {
    // Today = Wed. Add Tuesday-only expenses.
    const expenses = Array.from({ length: 5 }, (_, i) =>
      mk({ id: `t${i}`, amount: 120, description: '午餐', daysAgo: i * 7 + 1 }),
    )
    // i*7+1 days back from Wed = Tue every time
    expect(suggestNextExpense({ expenses, now: NOW })).toBeNull()
  })

  it('returns suggestion when 3+ expenses match dow + hour-window', () => {
    // Past 3 Wednesdays at noon — 便當 NT$120
    const expenses = [
      mk({ id: 'a', amount: 120, description: '便當', daysAgo: 7 }), // last Wed
      mk({ id: 'b', amount: 120, description: '便當', daysAgo: 14 }),
      mk({ id: 'c', amount: 120, description: '便當', daysAgo: 21 }),
    ]
    const r = suggestNextExpense({ expenses, now: NOW })
    expect(r).not.toBeNull()
    expect(r!.description).toBe('便當')
    expect(r!.amount).toBe(120)
    expect(r!.confidence).toBe(1)
    expect(r!.basedOn).toBe(3)
  })

  it('returns null when below minSupport', () => {
    const expenses = [
      mk({ id: 'a', amount: 120, description: '便當', daysAgo: 7 }),
      mk({ id: 'b', amount: 120, description: '便當', daysAgo: 14 }),
    ]
    expect(suggestNextExpense({ expenses, now: NOW, minSupport: 3 })).toBeNull()
  })

  it('returns null when below minConfidence (too noisy)', () => {
    // Past Wednesdays mixed: 5x 便當 + 5x 麵 + 5x 三明治 = no clear winner
    const expenses = [
      ...Array.from({ length: 5 }, (_, i) => mk({ id: `a${i}`, amount: 120, description: '便當', daysAgo: 7 + i * 7 })),
      ...Array.from({ length: 5 }, (_, i) => mk({ id: `b${i}`, amount: 100, description: '麵', daysAgo: 7 + i * 7 })),
      ...Array.from({ length: 5 }, (_, i) => mk({ id: `c${i}`, amount: 80, description: '三明治', daysAgo: 7 + i * 7 })),
    ]
    // confidence each = 5/15 ≈ 0.33 < 0.4 → null
    expect(suggestNextExpense({ expenses, now: NOW })).toBeNull()
  })

  it('uses ±2 hour window for matching', () => {
    // Today is Wed 12:00. ±2 → 10:00..14:00 OK
    const expenses = [
      mk({ id: 'a', amount: 120, description: '便當', daysAgo: 7, hour: 10 }), // 2h early - OK
      mk({ id: 'b', amount: 120, description: '便當', daysAgo: 14, hour: 14 }), // 2h late - OK
      mk({ id: 'c', amount: 120, description: '便當', daysAgo: 21, hour: 12 }),
      mk({ id: 'far', amount: 999, description: 'OTHER', daysAgo: 28, hour: 9 }), // too early
    ]
    const r = suggestNextExpense({ expenses, now: NOW })
    expect(r!.description).toBe('便當')
    expect(r!.basedOn).toBe(3) // far excluded
  })

  it('matches exact amounts (no bucketing)', () => {
    // Different amounts → different combos. With minSupport 3, three diff
    // amounts don't trigger.
    const expenses = [
      mk({ id: 'a', amount: 115, description: '便當', daysAgo: 7 }),
      mk({ id: 'b', amount: 130, description: '便當', daysAgo: 14 }),
      mk({ id: 'c', amount: 120, description: '便當', daysAgo: 21 }),
    ]
    expect(suggestNextExpense({ expenses, now: NOW })).toBeNull()
  })

  it('skips expenses outside windowDays', () => {
    const expenses = [
      mk({ id: 'recent', amount: 120, description: '便當', daysAgo: 7 }),
      mk({ id: 'recent2', amount: 120, description: '便當', daysAgo: 14 }),
      mk({ id: 'recent3', amount: 120, description: '便當', daysAgo: 21 }),
      mk({ id: 'old', amount: 999, description: 'OLD', daysAgo: 200 }),
    ]
    const r = suggestNextExpense({ expenses, now: NOW, windowDays: 90 })
    expect(r!.description).toBe('便當')
  })

  it('skips bad amount/date defensively', () => {
    const bad = { ...mk({ id: 'bad', amount: 100, description: '便當', daysAgo: 7 }), date: 'oops' } as unknown as Expense
    const expenses = [
      mk({ id: 'a', amount: 120, description: '便當', daysAgo: 7 }),
      mk({ id: 'b', amount: 120, description: '便當', daysAgo: 14 }),
      mk({ id: 'c', amount: 120, description: '便當', daysAgo: 21 }),
      mk({ id: 'nan', amount: NaN, description: 'X', daysAgo: 7 }),
      mk({ id: 'zero', amount: 0, description: 'X', daysAgo: 7 }),
      bad,
    ]
    const r = suggestNextExpense({ expenses, now: NOW })
    expect(r!.basedOn).toBe(3)
  })

  it('skips empty description', () => {
    const expenses = [
      mk({ id: 'a', amount: 120, description: '便當', daysAgo: 7 }),
      mk({ id: 'b', amount: 120, description: '便當', daysAgo: 14 }),
      mk({ id: 'c', amount: 120, description: '便當', daysAgo: 21 }),
      mk({ id: 'd', amount: 100, description: '', daysAgo: 7 }), // skipped
    ]
    const r = suggestNextExpense({ expenses, now: NOW })
    expect(r!.description).toBe('便當')
  })

  it('case-insensitive description matching', () => {
    const expenses = [
      mk({ id: 'a', amount: 120, description: 'Lunch', daysAgo: 7 }),
      mk({ id: 'b', amount: 120, description: 'lunch', daysAgo: 14 }),
      mk({ id: 'c', amount: 120, description: 'LUNCH', daysAgo: 21 }),
    ]
    const r = suggestNextExpense({ expenses, now: NOW })
    expect(r!.basedOn).toBe(3)
  })

  it('confidence calculated correctly', () => {
    // 3x 便當 + 1x 雞排 = 4 total, 3/4 = 0.75 confidence for 便當
    const expenses = [
      mk({ id: 'a', amount: 120, description: '便當', daysAgo: 7 }),
      mk({ id: 'b', amount: 120, description: '便當', daysAgo: 14 }),
      mk({ id: 'c', amount: 120, description: '便當', daysAgo: 21 }),
      mk({ id: 'd', amount: 80, description: '雞排', daysAgo: 28 }),
    ]
    const r = suggestNextExpense({ expenses, now: NOW })
    expect(r!.confidence).toBe(0.75)
  })
})

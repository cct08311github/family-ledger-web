import {
  getMonthStart,
  getDaysInMonth,
  calculateMonthTotal,
  classifyBudgetStatus,
} from '@/lib/budget'
import type { Expense } from '@/lib/types'
import { Timestamp } from 'firebase/firestore'

/** Helper: build a minimal expense doc fixture. */
function expense(date: Date, amount: number): Expense {
  return {
    id: `e-${date.toISOString()}-${amount}`,
    date: Timestamp.fromDate(date),
    description: 'test',
    amount,
    category: '餐飲',
    isShared: true,
    splitMethod: 'equal',
    payerId: 'p',
    payerName: 'P',
    splits: [],
    paymentMethod: 'cash',
    receiptPaths: [],
    createdBy: 'u',
  } as Expense
}

// ── getMonthStart ─────────────────────────────────────────────────────

describe('getMonthStart', () => {
  it('returns 2026-01-01 00:00 local for a date in January', () => {
    const s = getMonthStart(new Date(2026, 0, 18, 14, 30))
    expect(s.getFullYear()).toBe(2026)
    expect(s.getMonth()).toBe(0)
    expect(s.getDate()).toBe(1)
    expect(s.getHours()).toBe(0)
  })

  it('returns 2026-12-01 00:00 for December (last month wraparound test)', () => {
    const s = getMonthStart(new Date(2026, 11, 31, 23, 59))
    expect(s.getFullYear()).toBe(2026)
    expect(s.getMonth()).toBe(11)
    expect(s.getDate()).toBe(1)
  })

  it('returns 2024-02-01 for a leap-year February', () => {
    const s = getMonthStart(new Date(2024, 1, 15))
    expect(s.getMonth()).toBe(1)
    expect(s.getDate()).toBe(1)
  })
})

// ── getDaysInMonth ────────────────────────────────────────────────────

describe('getDaysInMonth', () => {
  it.each([
    ['January', 2026, 0, 31],
    ['February (non-leap 2025)', 2025, 1, 28],
    ['February (leap 2024)', 2024, 1, 29],
    ['March', 2026, 2, 31],
    ['April', 2026, 3, 30],
    ['July', 2026, 6, 31],
    ['December', 2026, 11, 31],
  ])('%s has correct days', (_name, year, monthIndex, expected) => {
    expect(getDaysInMonth(new Date(year, monthIndex, 10))).toBe(expected)
  })
})

// ── calculateMonthTotal ───────────────────────────────────────────────

describe('calculateMonthTotal', () => {
  const start = new Date(2026, 3, 1) // 2026-04-01 00:00

  it('sums expenses on or after the start date', () => {
    const expenses = [
      expense(new Date(2026, 3, 1, 0, 0), 100), // on boundary — included
      expense(new Date(2026, 3, 15, 12, 0), 250),
      expense(new Date(2026, 3, 30, 23, 59), 50),
    ]
    expect(calculateMonthTotal(expenses, start)).toBe(400)
  })

  it('excludes expenses from the previous month', () => {
    const expenses = [
      expense(new Date(2026, 2, 31, 23, 59, 59), 999), // last moment of March
      expense(new Date(2026, 3, 1, 0, 0), 100),
    ]
    expect(calculateMonthTotal(expenses, start)).toBe(100)
  })

  it('returns 0 for empty list', () => {
    expect(calculateMonthTotal([], start)).toBe(0)
  })

  it('returns 0 when all expenses are before start', () => {
    const expenses = [
      expense(new Date(2025, 11, 15), 500),
      expense(new Date(2026, 2, 10), 200),
    ]
    expect(calculateMonthTotal(expenses, start)).toBe(0)
  })

  it('includes everything >= since regardless of month (caller filters upper bound)', () => {
    // Helper's contract is `date >= since`, full stop. The component passes
    // "first of current month" as `since` and naturally has no future
    // expenses, so upper bound isn't needed. This test documents the helper
    // itself doesn't cap at end-of-month — a later call with a past `since`
    // date would include all subsequent months.
    const expenses = [
      expense(new Date(2026, 2, 20), 1000), // March — excluded (< April start)
      expense(new Date(2026, 3, 5), 200), // April — included
      expense(new Date(2026, 3, 10), 300), // April — included
      expense(new Date(2026, 4, 1), 500), // May — included (≥ April start; NOT capped)
    ]
    expect(calculateMonthTotal(expenses, start)).toBe(1000)
  })
})

// ── classifyBudgetStatus ──────────────────────────────────────────────

describe('classifyBudgetStatus', () => {
  const base = { budget: 30000, dayOfMonth: 15, daysInMonth: 30 }
  const fmt = (n: number) => `NT$${n}`

  it('returns "ok" when spending under pace', () => {
    const r = classifyBudgetStatus({ ...base, spent: 10000, formatCurrency: fmt })
    expect(r.kind).toBe('ok')
    expect(r.overBudget).toBe(false)
    expect(r.overPace).toBe(false)
    expect(r.percentUsed).toBe(33)
    expect(r.expectedByNow).toBe(15000)
    expect(r.statusText).toBe('領先 NT$5000')
  })

  it('returns "overPace" when ahead of pace but still under budget', () => {
    const r = classifyBudgetStatus({ ...base, spent: 20000, formatCurrency: fmt })
    expect(r.kind).toBe('overPace')
    expect(r.overBudget).toBe(false)
    expect(r.overPace).toBe(true)
    expect(r.statusText).toBe('超速 NT$5000')
  })

  it('returns "overBudget" when spent exceeds budget', () => {
    const r = classifyBudgetStatus({ ...base, spent: 35000, formatCurrency: fmt })
    expect(r.kind).toBe('overBudget')
    expect(r.overBudget).toBe(true)
    expect(r.overPace).toBe(true) // over-budget implies over-pace
    expect(r.percentUsed).toBe(117)
    expect(r.statusText).toBe('超支 NT$5000')
  })

  it('edge: spent exactly equals budget → not overBudget (strict >)', () => {
    const r = classifyBudgetStatus({ ...base, spent: 30000, formatCurrency: fmt })
    expect(r.overBudget).toBe(false)
    expect(r.percentUsed).toBe(100)
  })

  it('edge: spent exactly equals expectedByNow → not overPace (strict >)', () => {
    const r = classifyBudgetStatus({ ...base, spent: 15000, formatCurrency: fmt })
    expect(r.kind).toBe('ok')
    expect(r.overPace).toBe(false)
  })

  it('handles budget = 0 without dividing by zero', () => {
    const r = classifyBudgetStatus({ budget: 0, spent: 100, dayOfMonth: 10, daysInMonth: 30 })
    expect(r.percentUsed).toBe(0)
    expect(r.expectedByNow).toBe(0)
    expect(r.overBudget).toBe(false)
    expect(r.overPace).toBe(false)
    expect(r.kind).toBe('ok')
  })

  it('handles daysInMonth = 0 (pathological) without dividing by zero', () => {
    // Guard falls back to 30 days
    const r = classifyBudgetStatus({ budget: 30000, spent: 10000, dayOfMonth: 15, daysInMonth: 0 })
    expect(r.expectedByNow).toBe(15000) // 30000 * 15 / 30
  })

  it('default formatter matches app currency() style (NT$ with space + comma)', () => {
    // Regression guard: default must match the app-wide `currency()` helper
    // in @/lib/utils so UI rendered with default formatter looks identical.
    const r = classifyBudgetStatus({ budget: 30000, spent: 10000, dayOfMonth: 15, daysInMonth: 30 })
    expect(r.statusText).toBe('領先 NT$ 5,000')
  })

  it('formatter with thousand separator produces readable output', () => {
    const r = classifyBudgetStatus({
      budget: 1000000, spent: 600000, dayOfMonth: 15, daysInMonth: 30,
      formatCurrency: (n) => `NT$${n.toLocaleString()}`,
    })
    // 1M * 15/30 = 500000; spent 600000 → over pace by 100000
    expect(r.statusText).toBe('超速 NT$100,000')
  })

  it('negative budget treated as zero (no crash, returns ok)', () => {
    const r = classifyBudgetStatus({ budget: -5000, spent: 100, dayOfMonth: 10, daysInMonth: 30 })
    expect(r.kind).toBe('ok')
    expect(r.percentUsed).toBe(0)
  })
})

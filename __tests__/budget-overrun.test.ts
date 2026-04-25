import { checkBudgetOverrun } from '@/lib/budget-overrun'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15 (day 15 of 30)

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

describe('checkBudgetOverrun', () => {
  it('returns null when no budget set', () => {
    const expenses = [mkOnDate('a', 1000, 2026, 3, 1)]
    expect(
      checkBudgetOverrun({ expenses, monthlyBudget: null, now: NOW }),
    ).toBeNull()
    expect(
      checkBudgetOverrun({ expenses, monthlyBudget: undefined, now: NOW }),
    ).toBeNull()
    expect(
      checkBudgetOverrun({ expenses, monthlyBudget: 0, now: NOW }),
    ).toBeNull()
  })

  it('returns null when month too early (< 3 days)', () => {
    const day1 = new Date(2026, 3, 1, 12, 0, 0).getTime()
    expect(
      checkBudgetOverrun({
        expenses: [mkOnDate('a', 1000, 2026, 3, 1)],
        monthlyBudget: 1000,
        now: day1,
      }),
    ).toBeNull()
  })

  it('returns null when no current-month spending', () => {
    expect(
      checkBudgetOverrun({ expenses: [], monthlyBudget: 10000, now: NOW }),
    ).toBeNull()
  })

  it('returns null when projection within trigger threshold', () => {
    // Day 15: spent NT$5000 → projected NT$10000. Budget NT$10000 → exactly equal, NOT exceed.
    const expenses = [mkOnDate('a', 5000, 2026, 3, 1)]
    expect(
      checkBudgetOverrun({ expenses, monthlyBudget: 10000, now: NOW }),
    ).toBeNull()
  })

  it('returns warning when projection > budget × 1.05', () => {
    // Day 15: spent NT$6000 → projected NT$12000. Budget NT$10000 → 20% over → critical
    // For warning case, want 5-20%: spent NT$5500 → projected NT$11000 → 10% over
    const expenses = [mkOnDate('a', 5500, 2026, 3, 1)]
    const r = checkBudgetOverrun({ expenses, monthlyBudget: 10000, now: NOW })
    expect(r).not.toBeNull()
    expect(r!.severity).toBe('warning')
    expect(r!.projectedTotal).toBeCloseTo(11000)
    expect(r!.budget).toBe(10000)
    expect(r!.overrun).toBeCloseTo(1000)
    expect(r!.overrunPct).toBeCloseTo(0.1)
  })

  it('returns critical when projection ≥ budget × 1.20', () => {
    // Spent NT$6000 → projected NT$12000 = 20% over
    const expenses = [mkOnDate('a', 6000, 2026, 3, 1)]
    const r = checkBudgetOverrun({ expenses, monthlyBudget: 10000, now: NOW })
    expect(r!.severity).toBe('critical')
  })

  it('computes daysRemaining correctly', () => {
    // April 15 → 15 days remaining
    const expenses = [mkOnDate('a', 6000, 2026, 3, 1)]
    const r = checkBudgetOverrun({ expenses, monthlyBudget: 10000, now: NOW })
    expect(r!.daysRemaining).toBe(15)
  })

  it('requiredDailyToHitBudget reflects remaining budget / remaining days', () => {
    const expenses = [mkOnDate('a', 7000, 2026, 3, 1)]
    const r = checkBudgetOverrun({ expenses, monthlyBudget: 10000, now: NOW })
    // remaining: 10000 - 7000 = 3000, days remaining 15 → 200/day
    expect(r!.requiredDailyToHitBudget).toBe(200)
  })

  it('requiredDailyToHitBudget negative when already over budget', () => {
    const expenses = [mkOnDate('a', 12000, 2026, 3, 1)]
    const r = checkBudgetOverrun({ expenses, monthlyBudget: 10000, now: NOW })
    expect(r!.requiredDailyToHitBudget).toBeLessThan(0)
    expect(r!.severity).toBe('critical')
  })

  it('currentDailyPace = spentSoFar / daysSoFar', () => {
    const expenses = [mkOnDate('a', 7500, 2026, 3, 1)]
    const r = checkBudgetOverrun({ expenses, monthlyBudget: 10000, now: NOW })
    expect(r!.currentDailyPace).toBeCloseTo(500) // 7500 / 15
  })

  it('respects custom triggerThreshold', () => {
    const expenses = [mkOnDate('a', 5100, 2026, 3, 1)] // ~2% over (5100/15 * 30 = 10200)
    expect(
      checkBudgetOverrun({
        expenses,
        monthlyBudget: 10000,
        now: NOW,
        triggerThreshold: 1.01,
      }),
    ).not.toBeNull()
    expect(
      checkBudgetOverrun({
        expenses,
        monthlyBudget: 10000,
        now: NOW,
        triggerThreshold: 1.1,
      }),
    ).toBeNull()
  })

  it('handles end-of-month edge (daysRemaining = 0)', () => {
    const lastDay = new Date(2026, 3, 30, 23, 0, 0).getTime()
    const expenses = [mkOnDate('a', 12000, 2026, 3, 15)]
    const r = checkBudgetOverrun({ expenses, monthlyBudget: 10000, now: lastDay })
    expect(r!.daysRemaining).toBe(0)
    // requiredDaily falls back to total remaining (negative since over budget)
    expect(r!.requiredDailyToHitBudget).toBeLessThan(0)
  })
})

import { detectCatchupNudge } from '@/lib/catchup-detector'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15, noon

function mk(id: string, daysAgo: number): Expense {
  const d = new Date(NOW - daysAgo * 86_400_000)
  return {
    id,
    groupId: 'g1',
    description: 'e',
    amount: 100,
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

describe('detectCatchupNudge', () => {
  it('returns null with empty expenses', () => {
    expect(detectCatchupNudge({ expenses: [], now: NOW })).toBeNull()
  })

  it('returns null when most recent is today', () => {
    expect(detectCatchupNudge({ expenses: [mk('a', 0)], now: NOW })).toBeNull()
  })

  it('returns null when gap is 1 day (below default threshold of 4)', () => {
    expect(detectCatchupNudge({ expenses: [mk('a', 1)], now: NOW })).toBeNull()
  })

  it('returns null when gap is exactly 3 days (still below 4)', () => {
    expect(detectCatchupNudge({ expenses: [mk('a', 3)], now: NOW })).toBeNull()
  })

  it('triggers at exactly 4 days', () => {
    const r = detectCatchupNudge({ expenses: [mk('a', 4)], now: NOW })
    expect(r).not.toBeNull()
    expect(r?.daysGap).toBe(4)
  })

  it('triggers at 7 days with correct lastRecordedDate', () => {
    const r = detectCatchupNudge({ expenses: [mk('a', 7)], now: NOW })
    expect(r?.daysGap).toBe(7)
    expect(r?.lastRecordedDate).toBe('2026-04-08')
  })

  it('uses the most recent expense, ignoring older records', () => {
    const expenses = [mk('old', 30), mk('newer', 5), mk('newest', 2)]
    const r = detectCatchupNudge({ expenses, now: NOW })
    // Most recent = 2 days ago → below threshold
    expect(r).toBeNull()
  })

  it('triggers on most recent gap even with very old records also present', () => {
    const expenses = [mk('old', 60), mk('mid', 30), mk('lastRecorded', 6)]
    const r = detectCatchupNudge({ expenses, now: NOW })
    expect(r?.daysGap).toBe(6)
  })

  it('respects custom threshold', () => {
    const expenses = [mk('a', 2)]
    expect(detectCatchupNudge({ expenses, now: NOW, thresholdDays: 2 })?.daysGap).toBe(2)
    expect(detectCatchupNudge({ expenses, now: NOW, thresholdDays: 3 })).toBeNull()
  })

  it('skips records with bad dates', () => {
    const bad = { ...mk('bad', 1), date: 'oops' } as unknown as Expense
    const ok = mk('good', 7)
    const r = detectCatchupNudge({ expenses: [bad, ok], now: NOW })
    expect(r?.daysGap).toBe(7)
  })

  it('skips records with non-finite timestamp', () => {
    const bad = { ...mk('bad', 1), date: new Date(NaN) } as unknown as Expense
    const ok = mk('good', 5)
    const r = detectCatchupNudge({ expenses: [bad, ok], now: NOW })
    expect(r?.daysGap).toBe(5)
  })

  it('day-level granularity ignores time-of-day', () => {
    // Expense at 23:59 yesterday, now is 00:01 today — 1 day diff regardless
    const expense = mk('a', 0)
    expense.date = new Date(NOW - 86_400_000 + 60_000) as unknown as Expense['date']
    const r = detectCatchupNudge({ expenses: [expense], now: NOW })
    // 1 day gap only — below threshold
    expect(r).toBeNull()
  })
})

import { detectSubscriptionCandidates } from '@/lib/subscription-detector'
import type { Expense, RecurringExpense } from '@/lib/types'

const NOW = new Date(2026, 3, 15).getTime()
const DAY = 86_400_000

function mk(
  id: string,
  description: string,
  amount: number,
  daysAgo: number,
  category = '其他',
  isShared = true,
): Expense {
  const d = new Date(NOW - daysAgo * DAY)
  return {
    id,
    groupId: 'g1',
    description,
    amount,
    category,
    payerId: 'm1',
    payerName: '爸',
    isShared,
    splitMethod: 'equal',
    splits: [],
    paymentMethod: 'cash',
    date: d,
    createdAt: d,
    createdBy: 'u1',
    receiptPaths: [],
  } as unknown as Expense
}

describe('detectSubscriptionCandidates', () => {
  it('returns empty when no expenses', () => {
    expect(detectSubscriptionCandidates({ expenses: [], recurringTemplates: [], now: NOW })).toEqual([])
  })

  it('detects clean monthly pattern (3 occurrences ~30 days apart)', () => {
    const expenses = [
      mk('a', 'Netflix', 990, 60),
      mk('b', 'Netflix', 990, 30),
      mk('c', 'Netflix', 990, 0),
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r).toHaveLength(1)
    expect(r[0].description).toBe('Netflix')
    expect(r[0].amount).toBe(990)
    expect(r[0].cadence).toBe('monthly')
    expect(r[0].occurrences).toBe(3)
  })

  it('detects weekly pattern (~7 days apart)', () => {
    const expenses = [
      mk('a', '健身房', 500, 21),
      mk('b', '健身房', 500, 14),
      mk('c', '健身房', 500, 7),
      mk('d', '健身房', 500, 0),
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r).toHaveLength(1)
    expect(r[0].cadence).toBe('weekly')
    expect(r[0].suggestedDayOfWeek).not.toBeNull()
  })

  it('rejects irregular intervals', () => {
    const expenses = [
      mk('a', 'X', 100, 60),
      mk('b', 'X', 100, 50), // 10 days — not weekly, not monthly
      mk('c', 'X', 100, 0),
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r).toHaveLength(0)
  })

  it('rejects mixed cadences (not all gaps same kind)', () => {
    const expenses = [
      mk('a', 'X', 100, 60),
      mk('b', 'X', 100, 30), // 30 day gap (monthly)
      mk('c', 'X', 100, 23), // 7 day gap (weekly) — mixed
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r).toHaveLength(0)
  })

  it('skips already-managed templates (case insensitive)', () => {
    const expenses = [
      mk('a', 'Netflix', 990, 60),
      mk('b', 'Netflix', 990, 30),
      mk('c', 'Netflix', 990, 0),
    ]
    const templates = [
      { description: 'NETFLIX', amount: 990 } as unknown as RecurringExpense,
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: templates, now: NOW })
    expect(r).toHaveLength(0)
  })

  it('skips personal expenses (isShared=false)', () => {
    const expenses = [
      mk('a', 'Spotify', 149, 60, 'X', false),
      mk('b', 'Spotify', 149, 30, 'X', false),
      mk('c', 'Spotify', 149, 0, 'X', false),
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r).toHaveLength(0)
  })

  it('skips records older than lookback window', () => {
    const expenses = [
      mk('o1', 'Old', 500, 200), // clearly outside 90-day window
      mk('o2', 'Old', 500, 150), // clearly outside
      mk('o3', 'Old', 500, 60), // inside, but only 1 sample after cutoff
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    // Within window: only o3. < 2 → no detect
    expect(r).toHaveLength(0)
  })

  it('groups by description+amount independently', () => {
    const expenses = [
      // Netflix 990 monthly
      mk('a', 'Netflix', 990, 60),
      mk('b', 'Netflix', 990, 30),
      mk('c', 'Netflix', 990, 0),
      // Spotify 149 monthly
      mk('d', 'Spotify', 149, 60),
      mk('e', 'Spotify', 149, 30),
      mk('f', 'Spotify', 149, 0),
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r).toHaveLength(2)
    const descs = r.map((c) => c.description)
    expect(descs).toContain('Netflix')
    expect(descs).toContain('Spotify')
  })

  it('sorts by occurrences desc, then amount desc', () => {
    const expenses = [
      // 4 occurrences of 'Spotify 149'
      mk('s1', 'Spotify', 149, 90),
      mk('s2', 'Spotify', 149, 60),
      mk('s3', 'Spotify', 149, 30),
      mk('s4', 'Spotify', 149, 0),
      // 3 occurrences of 'Netflix 990' — fewer but bigger amount
      mk('n1', 'Netflix', 990, 60),
      mk('n2', 'Netflix', 990, 30),
      mk('n3', 'Netflix', 990, 0),
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r[0].description).toBe('Spotify') // 4 > 3
    expect(r[1].description).toBe('Netflix')
  })

  it('description normalize: trim case-insensitive matching', () => {
    const expenses = [
      mk('a', 'Netflix', 990, 60),
      mk('b', '  netflix ', 990, 30), // same after normalize
      mk('c', 'NETFLIX', 990, 0),
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r).toHaveLength(1)
    expect(r[0].occurrences).toBe(3)
  })

  it('different amounts of same description NOT grouped together', () => {
    const expenses = [
      mk('a', 'Costco', 5000, 60),
      mk('b', 'Costco', 7000, 30),
      mk('c', 'Costco', 3000, 0),
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r).toHaveLength(0) // Different amounts → 3 separate groups, each size 1
  })

  it('suggestedDayOfMonth picks the most common day', () => {
    const expenses = [
      mk('a', 'X', 100, 60), // ~Feb 14
      mk('b', 'X', 100, 30), // ~Mar 16
      mk('c', 'X', 100, 0), // Apr 15
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r).toHaveLength(1)
    expect(r[0].suggestedDayOfMonth).toBeGreaterThanOrEqual(1)
    expect(r[0].suggestedDayOfMonth).toBeLessThanOrEqual(31)
  })

  it('skips records with non-finite amount', () => {
    const expenses = [
      mk('a', 'Netflix', 990, 60),
      mk('bad', 'Netflix', NaN, 45),
      mk('b', 'Netflix', 990, 30),
      mk('c', 'Netflix', 990, 0),
    ]
    const r = detectSubscriptionCandidates({ expenses, recurringTemplates: [], now: NOW })
    expect(r).toHaveLength(1)
    expect(r[0].occurrences).toBe(3)
  })
})

import { analyzeSettlementCadence } from '@/lib/settlement-cadence'
import type { Settlement } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15

function mk(id: string, amount: number, daysAgo: number): Settlement {
  const d = new Date(NOW - daysAgo * 86_400_000)
  return {
    id,
    groupId: 'g1',
    fromMemberId: 'm1',
    fromMemberName: '爸',
    toMemberId: 'm2',
    toMemberName: '媽',
    amount,
    date: d,
    createdAt: d,
    createdBy: 'u1',
  } as unknown as Settlement
}

describe('analyzeSettlementCadence', () => {
  it('returns null when no settlements', () => {
    expect(analyzeSettlementCadence({ settlements: [], now: NOW })).toBeNull()
  })

  it('returns null when only invalid records', () => {
    const bad = { ...mk('a', 100, 1), date: 'oops' } as unknown as Settlement
    const expenses = [bad, mk('zero', 0, 1), mk('nan', NaN, 1), mk('neg', -10, 1)]
    expect(analyzeSettlementCadence({ settlements: expenses, now: NOW })).toBeNull()
  })

  it('computes single-settlement cadence (no gap data)', () => {
    const settlements = [mk('a', 1500, 5)]
    const r = analyzeSettlementCadence({ settlements, now: NOW })
    expect(r!.daysSinceLast).toBe(5)
    expect(r!.lastSettlementDate).toBe('2026-04-10')
    expect(r!.ytdCount).toBe(1)
    expect(r!.ytdAmount).toBe(1500)
    expect(r!.avgDaysBetween).toBeNull()
    expect(r!.longestGap).toBeNull()
  })

  it('computes avg gap and longest gap', () => {
    // Settlements 60, 30, 10 days ago → gaps: 30 days (60→30), 20 days (30→10)
    // avg = 25, longest = 30
    const settlements = [mk('a', 100, 60), mk('b', 100, 30), mk('c', 100, 10)]
    const r = analyzeSettlementCadence({ settlements, now: NOW })
    expect(r!.avgDaysBetween).toBeCloseTo(25)
    expect(r!.longestGap).toBeCloseTo(30)
    expect(r!.daysSinceLast).toBe(10)
  })

  it('YTD count and amount limited to current calendar year', () => {
    // Last year: Dec 2025 (~120 days ago in April 2026)
    // Current year: this year settlements
    const settlements = [
      mk('lastYear', 999, 200), // Sep 2025 — outside YTD
      mk('curr1', 100, 30), // March 2026
      mk('curr2', 200, 60), // Feb 2026
      mk('curr3', 300, 5), // April 2026
    ]
    const r = analyzeSettlementCadence({ settlements, now: NOW })
    expect(r!.ytdCount).toBe(3)
    expect(r!.ytdAmount).toBe(600)
  })

  it('skips bad amount/date defensively', () => {
    const bad = { ...mk('bad', 100, 5), date: 'oops' } as unknown as Settlement
    const settlements = [
      mk('valid', 100, 5),
      mk('zero', 0, 5),
      mk('nan', NaN, 5),
      mk('neg', -50, 5),
      bad,
    ]
    const r = analyzeSettlementCadence({ settlements, now: NOW })
    expect(r!.daysSinceLast).toBe(5)
    expect(r!.ytdCount).toBe(1)
  })

  it('skips future-dated settlements', () => {
    const future = mk('future', 999, -10)
    const past = mk('past', 100, 5)
    const r = analyzeSettlementCadence({ settlements: [future, past], now: NOW })
    expect(r!.daysSinceLast).toBe(5)
    expect(r!.ytdCount).toBe(1)
  })

  it('orders by date — last settlement is most recent ts', () => {
    // Out-of-order input
    const settlements = [mk('old', 100, 60), mk('new', 200, 1), mk('mid', 150, 30)]
    const r = analyzeSettlementCadence({ settlements, now: NOW })
    expect(r!.daysSinceLast).toBe(1)
    expect(r!.lastSettlementDate).toBe('2026-04-14')
  })

  it('handles 0-day-since-last (settled today)', () => {
    const settlements = [mk('a', 100, 0)]
    const r = analyzeSettlementCadence({ settlements, now: NOW })
    expect(r!.daysSinceLast).toBe(0)
  })

  it('avgDaysBetween reflects exactly N-1 gaps', () => {
    // 4 settlements at 0, 10, 20, 30 days ago → 3 gaps of 10 days each
    const settlements = [
      mk('a', 100, 30),
      mk('b', 100, 20),
      mk('c', 100, 10),
      mk('d', 100, 0),
    ]
    const r = analyzeSettlementCadence({ settlements, now: NOW })
    expect(r!.avgDaysBetween).toBeCloseTo(10)
    expect(r!.longestGap).toBeCloseTo(10)
  })

  it('longestGap is true max even with mixed gaps', () => {
    // 4 settlements: 100, 90, 30, 0 days ago → gaps: 10, 60, 30
    const settlements = [
      mk('a', 100, 100),
      mk('b', 100, 90),
      mk('c', 100, 30),
      mk('d', 100, 0),
    ]
    const r = analyzeSettlementCadence({ settlements, now: NOW })
    expect(r!.longestGap).toBeCloseTo(60)
    expect(r!.avgDaysBetween).toBeCloseTo((10 + 60 + 30) / 3)
  })
})

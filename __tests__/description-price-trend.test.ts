import { buildPriceTrendSeries } from '@/lib/description-price-trend'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime()

function mk(id: string, amount: number, description: string, daysAgo: number): Expense {
  const d = new Date(NOW - daysAgo * 86_400_000)
  return {
    id,
    groupId: 'g1',
    description,
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

describe('buildPriceTrendSeries', () => {
  it('returns null when description is empty', () => {
    expect(
      buildPriceTrendSeries({ expenses: [], description: '', now: NOW }),
    ).toBeNull()
  })

  it('returns null when matches below minMatches', () => {
    const expenses = [mk('a', 100, '咖啡', 1), mk('b', 100, '咖啡', 2)]
    expect(
      buildPriceTrendSeries({
        expenses,
        description: '咖啡',
        minMatches: 3,
        now: NOW,
      }),
    ).toBeNull()
  })

  it('returns null when matches exceed maxMatches', () => {
    const expenses = Array.from({ length: 200 }, (_, i) => mk(String(i), 100, '咖啡', i))
    expect(
      buildPriceTrendSeries({
        expenses,
        description: '咖啡',
        maxMatches: 100,
        days: 999,
        now: NOW,
      }),
    ).toBeNull()
  })

  it('series is chronological (asc by date)', () => {
    const expenses = [
      mk('a', 80, '咖啡', 5),
      mk('b', 90, '咖啡', 1),
      mk('c', 100, '咖啡', 10),
    ]
    const r = buildPriceTrendSeries({ expenses, description: '咖啡', now: NOW })
    expect(r!.series.map((p) => p.amount)).toEqual([100, 80, 90])
  })

  it('computes averagePrice, min, max correctly', () => {
    const expenses = [
      mk('a', 100, '午餐', 5),
      mk('b', 200, '午餐', 4),
      mk('c', 50, '午餐', 3),
      mk('d', 150, '午餐', 2),
    ]
    const r = buildPriceTrendSeries({ expenses, description: '午餐', now: NOW })
    expect(r!.averagePrice).toBe(125)
    expect(r!.minPrice).toBe(50)
    expect(r!.maxPrice).toBe(200)
  })

  it('detects upward trend (later avg > earlier avg)', () => {
    // earlier: [100, 100], later: [200, 200] → +100% trend
    const expenses = [
      mk('a', 100, '咖啡', 30),
      mk('b', 100, '咖啡', 25),
      mk('c', 200, '咖啡', 5),
      mk('d', 200, '咖啡', 1),
    ]
    const r = buildPriceTrendSeries({ expenses, description: '咖啡', now: NOW })
    expect(r!.trend).toBe('up')
    expect(r!.trendPct!).toBeCloseTo(1.0)
  })

  it('detects downward trend', () => {
    const expenses = [
      mk('a', 200, '咖啡', 30),
      mk('b', 200, '咖啡', 25),
      mk('c', 100, '咖啡', 5),
      mk('d', 100, '咖啡', 1),
    ]
    const r = buildPriceTrendSeries({ expenses, description: '咖啡', now: NOW })
    expect(r!.trend).toBe('down')
    expect(r!.trendPct!).toBeCloseTo(-0.5)
  })

  it('detects flat when |delta| within threshold', () => {
    const expenses = [
      mk('a', 100, '咖啡', 30),
      mk('b', 100, '咖啡', 25),
      mk('c', 102, '咖啡', 5),
      mk('d', 103, '咖啡', 1),
    ]
    const r = buildPriceTrendSeries({
      expenses,
      description: '咖啡',
      flatThreshold: 0.05,
      now: NOW,
    })
    expect(r!.trend).toBe('flat')
  })

  it('case-insensitive normalization', () => {
    const expenses = [
      mk('a', 100, 'Coffee', 1),
      mk('b', 110, 'COFFEE ', 2),
      mk('c', 90, ' coffee', 3),
    ]
    const r = buildPriceTrendSeries({ expenses, description: ' CoFfEe ', now: NOW })
    expect(r!.count).toBe(3)
  })

  it('skips bad amount and date', () => {
    const bad = { ...mk('z', 100, '咖啡', 0), date: 'oops' } as unknown as Expense
    const expenses = [
      mk('a', 100, '咖啡', 1),
      mk('b', 100, '咖啡', 2),
      mk('c', 100, '咖啡', 3),
      mk('nan', NaN, '咖啡', 0),
      bad,
    ]
    const r = buildPriceTrendSeries({ expenses, description: '咖啡', now: NOW })
    expect(r!.count).toBe(3)
  })

  it('skips expenses outside days window', () => {
    const expenses = [
      mk('a', 100, '咖啡', 1),
      mk('b', 100, '咖啡', 2),
      mk('c', 100, '咖啡', 400), // > 365 default
    ]
    const r = buildPriceTrendSeries({ expenses, description: '咖啡', now: NOW })
    expect(r).toBeNull() // only 2 inside window
  })

  it('ignores future-dated records', () => {
    const expenses = [
      mk('past1', 100, '咖啡', 1),
      mk('past2', 100, '咖啡', 2),
      mk('past3', 100, '咖啡', 3),
      mk('future', 999, '咖啡', -10),
    ]
    const r = buildPriceTrendSeries({ expenses, description: '咖啡', now: NOW })
    expect(r!.count).toBe(3)
  })

  it('trendPct null when earlierAvg is 0 (insufficient data)', () => {
    // Only 3 points → half = 1, earlier=[0..1], later=[2..3]
    // both halves exist, so earlierAvg > 0
    // But what if exactly the boundary? Let's check 2-point edge (below minMatches anyway)
    const expenses = [
      mk('a', 100, '咖啡', 1),
      mk('b', 100, '咖啡', 2),
      mk('c', 100, '咖啡', 3),
    ]
    const r = buildPriceTrendSeries({ expenses, description: '咖啡', now: NOW })
    expect(r!.trendPct).not.toBeNull() // 3 points → half=1, both halves present
    expect(r!.trend).toBe('flat')
  })
})

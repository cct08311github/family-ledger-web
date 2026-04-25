import { analyzeHourOfDay } from '@/lib/hour-of-day'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime()

function mk(id: string, amount: number, daysAgo: number, hour: number): Expense {
  const d = new Date(NOW - daysAgo * 86_400_000)
  d.setHours(hour, 0, 0, 0)
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

describe('analyzeHourOfDay', () => {
  it('returns null when days <= 0', () => {
    expect(analyzeHourOfDay({ expenses: [], days: 0, now: NOW })).toBeNull()
  })

  it('returns null when below minExpenses', () => {
    const expenses = Array.from({ length: 10 }, (_, i) => mk(String(i), 100, i, 12))
    expect(
      analyzeHourOfDay({ expenses, now: NOW, minExpenses: 30 }),
    ).toBeNull()
  })

  it('aggregates by hour', () => {
    // Use daysAgo>=1 to avoid future-time exclusion (NOW = today noon)
    const expenses = [
      ...Array.from({ length: 15 }, (_, i) => mk(`a${i}`, 200, i + 1, 12)),
      ...Array.from({ length: 10 }, (_, i) => mk(`b${i}`, 300, i + 1, 19)),
      ...Array.from({ length: 5 }, (_, i) => mk(`c${i}`, 100, i + 1, 9)),
    ]
    const r = analyzeHourOfDay({ expenses, days: 30, now: NOW })
    expect(r).not.toBeNull()
    expect(r!.hourBuckets[12]).toBe(15 * 200) // 3000
    expect(r!.hourBuckets[19]).toBe(10 * 300) // 3000
    expect(r!.hourBuckets[9]).toBe(500)
  })

  it('peakHour is hour with highest total amount', () => {
    const expenses = [
      ...Array.from({ length: 30 }, (_, i) => mk(`a${i}`, 200, i, 12)), // 12 = 6000
      ...Array.from({ length: 5 }, (_, i) => mk(`b${i}`, 100, i, 18)), // 18 = 500
    ]
    const r = analyzeHourOfDay({ expenses, days: 30, now: NOW })
    expect(r!.peakHour).toBe(12)
  })

  it('isUniform=true when distribution flat', () => {
    // Spread across all 24 hours evenly
    const expenses: Expense[] = []
    for (let h = 0; h < 24; h++) {
      for (let i = 0; i < 2; i++) {
        expenses.push(mk(`${h}-${i}`, 100, i, h))
      }
    }
    const r = analyzeHourOfDay({ expenses, now: NOW })
    expect(r!.isUniform).toBe(true)
  })

  it('isUniform=false when peak is strong', () => {
    const expenses = [
      ...Array.from({ length: 30 }, (_, i) => mk(`peak${i}`, 500, i, 12)), // huge peak
      ...Array.from({ length: 5 }, (_, i) => mk(`other${i}`, 50, i, 18)),
    ]
    const r = analyzeHourOfDay({ expenses, now: NOW })
    expect(r!.isUniform).toBe(false)
  })

  it('segments cover all hours', () => {
    const expenses = Array.from({ length: 30 }, (_, i) => mk(`a${i}`, 100, i, 12))
    const r = analyzeHourOfDay({ expenses, now: NOW })
    const totalShareAcrossSegments = r!.segments.reduce((s, seg) => s + seg.share, 0)
    expect(totalShareAcrossSegments).toBeCloseTo(1)
  })

  it('skips expenses outside window', () => {
    const expenses = [
      ...Array.from({ length: 30 }, (_, i) => mk(`inside${i}`, 100, i, 12)),
      mk('outside', 9999, 100, 3), // 100 days ago
    ]
    const r = analyzeHourOfDay({ expenses, days: 30, now: NOW })
    expect(r!.totalAmount).toBe(30 * 100) // outside excluded
  })

  it('skips bad amount/date defensively', () => {
    const bad = { ...mk('bad', 100, 0, 12), date: 'oops' } as unknown as Expense
    const expenses = [
      ...Array.from({ length: 30 }, (_, i) => mk(`v${i}`, 100, i, 12)),
      mk('nan', NaN, 0, 12),
      mk('zero', 0, 0, 12),
      bad,
    ]
    const r = analyzeHourOfDay({ expenses, now: NOW })
    expect(r!.count).toBe(30) // 3 bad excluded
  })

  it('lunch segment captures hours 11-14', () => {
    const expenses = [
      ...Array.from({ length: 10 }, (_, i) => mk(`a${i}`, 200, i + 1, 11)),
      ...Array.from({ length: 10 }, (_, i) => mk(`b${i}`, 200, i + 1, 12)),
      ...Array.from({ length: 10 }, (_, i) => mk(`c${i}`, 200, i + 1, 13)),
      // 14 should NOT be in lunch (exclusive end)
      ...Array.from({ length: 10 }, (_, i) => mk(`d${i}`, 200, i + 1, 14)),
    ]
    const r = analyzeHourOfDay({ expenses, now: NOW })
    const lunch = r!.segments.find((s) => s.label.includes('午餐'))!
    expect(lunch.total).toBe(30 * 200) // 11, 12, 13 only
    const afternoon = r!.segments.find((s) => s.label.includes('下午'))!
    expect(afternoon.total).toBe(10 * 200) // 14 onwards
  })

  it('handles all 24 hours represented in buckets', () => {
    const expenses = Array.from({ length: 30 }, (_, i) => mk(`a${i}`, 100, i, 12))
    const r = analyzeHourOfDay({ expenses, now: NOW })
    expect(r!.hourBuckets.length).toBe(24)
    expect(r!.hourCounts.length).toBe(24)
  })

  it('hourCounts reflect counts not amounts', () => {
    const expenses = [
      // Use daysAgo 0..29 (all within 30-day window, hour 9 always past today's noon)
      ...Array.from({ length: 30 }, (_, i) => mk(`a${i}`, 1000, i, 9)),
      // hour 10 still before today's noon — daysAgo=0 is past today
      ...Array.from({ length: 5 }, (_, i) => mk(`b${i}`, 100, i, 10)),
    ]
    const r = analyzeHourOfDay({ expenses, now: NOW })
    expect(r!.hourCounts[9]).toBe(30)
    expect(r!.hourCounts[10]).toBe(5)
  })
})

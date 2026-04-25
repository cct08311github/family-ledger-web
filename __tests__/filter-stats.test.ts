import { computeFilterStats } from '@/lib/filter-stats'
import type { Expense } from '@/lib/types'

function mk(id: string, amount: number): Expense {
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
    date: new Date(),
    createdAt: new Date(),
    createdBy: 'u1',
    receiptPaths: [],
  } as unknown as Expense
}

describe('computeFilterStats', () => {
  it('returns null below min count', () => {
    expect(computeFilterStats({ expenses: [] })).toBeNull()
    expect(computeFilterStats({ expenses: [mk('a', 100)] })).toBeNull()
    expect(computeFilterStats({ expenses: [mk('a', 100), mk('b', 200)] })).toBeNull()
  })

  it('computes basic stats for odd count', () => {
    const expenses = [mk('a', 100), mk('b', 200), mk('c', 300)]
    const r = computeFilterStats({ expenses })
    expect(r!.count).toBe(3)
    expect(r!.total).toBe(600)
    expect(r!.average).toBe(200)
    expect(r!.median).toBe(200)
    expect(r!.max).toBe(300)
    expect(r!.min).toBe(100)
  })

  it('median for even count is average of two middle values', () => {
    const expenses = [mk('a', 100), mk('b', 200), mk('c', 300), mk('d', 400)]
    const r = computeFilterStats({ expenses })
    expect(r!.median).toBe(250) // (200+300)/2
  })

  it('skips bad amount records', () => {
    const expenses = [
      mk('valid1', 100),
      mk('valid2', 200),
      mk('valid3', 300),
      mk('nan', NaN),
      mk('zero', 0),
      mk('neg', -50),
      mk('inf', Infinity),
    ]
    const r = computeFilterStats({ expenses })
    expect(r!.count).toBe(3)
  })

  it('respects custom minCount', () => {
    const expenses = [mk('a', 100), mk('b', 200)]
    expect(computeFilterStats({ expenses, minCount: 2 })).not.toBeNull()
    expect(computeFilterStats({ expenses, minCount: 3 })).toBeNull()
  })

  it('handles unsorted input correctly', () => {
    const expenses = [mk('c', 300), mk('a', 100), mk('b', 200)]
    const r = computeFilterStats({ expenses })
    expect(r!.min).toBe(100)
    expect(r!.max).toBe(300)
    expect(r!.median).toBe(200)
  })

  it('handles all-same amounts', () => {
    const expenses = [mk('a', 100), mk('b', 100), mk('c', 100)]
    const r = computeFilterStats({ expenses })
    expect(r!.average).toBe(100)
    expect(r!.median).toBe(100)
    expect(r!.max).toBe(100)
    expect(r!.min).toBe(100)
  })

  it('detects extreme outlier impact (avg > median)', () => {
    const expenses = [
      mk('small1', 100),
      mk('small2', 100),
      mk('small3', 100),
      mk('outlier', 9700),
    ]
    const r = computeFilterStats({ expenses })
    expect(r!.average).toBe(2500) // (100+100+100+9700)/4
    expect(r!.median).toBe(100) // (100+100)/2
    // Median << average reveals outlier
  })

  it('large dataset (1000 items)', () => {
    const expenses = Array.from({ length: 1000 }, (_, i) => mk(String(i), i + 1))
    const r = computeFilterStats({ expenses })
    expect(r!.count).toBe(1000)
    expect(r!.min).toBe(1)
    expect(r!.max).toBe(1000)
    expect(r!.median).toBe(500.5) // (500 + 501) / 2
  })

  it('total = sum of all amounts', () => {
    const expenses = [mk('a', 100), mk('b', 250), mk('c', 75)]
    const r = computeFilterStats({ expenses })
    expect(r!.total).toBe(425)
  })
})

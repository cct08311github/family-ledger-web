import { detectAmountOutlier } from '@/lib/amount-outlier'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15).getTime()

function mk(id: string, amount: number, category: string, daysAgo: number): Expense {
  const d = new Date(NOW - daysAgo * 86_400_000)
  return {
    id,
    groupId: 'g1',
    description: `e-${id}`,
    amount,
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

describe('detectAmountOutlier', () => {
  describe('skip conditions', () => {
    it('returns non-outlier when amount is invalid', () => {
      const r = detectAmountOutlier({
        amount: 0,
        category: '餐飲',
        expenses: [mk('a', 100, '餐飲', 1)],
        now: NOW,
      })
      expect(r.isOutlier).toBe(false)
    })

    it('returns non-outlier when category is empty', () => {
      const r = detectAmountOutlier({
        amount: 100,
        category: '',
        expenses: [mk('a', 100, '餐飲', 1)],
        now: NOW,
      })
      expect(r.isOutlier).toBe(false)
    })

    it('returns non-outlier with < 3 historical samples', () => {
      const r = detectAmountOutlier({
        amount: 99999,
        category: '餐飲',
        expenses: [mk('a', 100, '餐飲', 1), mk('b', 200, '餐飲', 2)],
        now: NOW,
      })
      expect(r.isOutlier).toBe(false)
      expect(r.sampleSize).toBe(2)
    })

    it('skips records older than the lookback window', () => {
      // 95 days ago is outside the 90-day window
      const old = [
        mk('o1', 100, '餐飲', 95),
        mk('o2', 100, '餐飲', 96),
        mk('o3', 100, '餐飲', 97),
      ]
      const r = detectAmountOutlier({
        amount: 99999,
        category: '餐飲',
        expenses: old,
        now: NOW,
      })
      expect(r.isOutlier).toBe(false)
      expect(r.sampleSize).toBe(0)
    })
  })

  describe('digit_jump signal', () => {
    it('triggers when amount has 2+ more digits than max historical', () => {
      const history = [
        mk('a', 100, '餐飲', 1),
        mk('b', 200, '餐飲', 2),
        mk('c', 300, '餐飲', 3),
      ]
      // 100/200/300 = max 3 digits. 50000 = 5 digits → 5-3 = 2 → trigger
      const r = detectAmountOutlier({
        amount: 50000,
        category: '餐飲',
        expenses: history,
        now: NOW,
      })
      expect(r.isOutlier).toBe(true)
      expect(r.kind).toBe('digit_jump')
    })

    it('does NOT trigger digit-jump for +1 digit only', () => {
      const history = [
        mk('a', 100, '餐飲', 1),
        mk('b', 200, '餐飲', 2),
        mk('c', 300, '餐飲', 3),
      ]
      // max 3 digits, 1500 = 4 digits → +1, NOT trigger digit_jump.
      // (May still trigger magnitude — see next test)
      const r = detectAmountOutlier({
        amount: 1500,
        category: '餐飲',
        expenses: history,
        now: NOW,
      })
      expect(r.kind).not.toBe('digit_jump')
    })
  })

  describe('magnitude_jump signal', () => {
    it('triggers when amount is > 5x median', () => {
      const history = [
        mk('a', 100, '餐飲', 1),
        mk('b', 200, '餐飲', 2),
        mk('c', 300, '餐飲', 3),
      ]
      // median = 200, 5x = 1000, current 1500 > 1000 → trigger
      const r = detectAmountOutlier({
        amount: 1500,
        category: '餐飲',
        expenses: history,
        now: NOW,
      })
      expect(r.isOutlier).toBe(true)
      expect(r.kind).toBe('magnitude_jump')
    })

    it('does NOT trigger when amount is < 5x median', () => {
      const history = [
        mk('a', 100, '餐飲', 1),
        mk('b', 200, '餐飲', 2),
        mk('c', 300, '餐飲', 3),
      ]
      // median 200, 4x = 800. current 700 < 1000 → no trigger
      const r = detectAmountOutlier({
        amount: 700,
        category: '餐飲',
        expenses: history,
        now: NOW,
      })
      expect(r.isOutlier).toBe(false)
    })
  })

  describe('signal precedence', () => {
    it('prefers digit_jump over magnitude_jump when both apply', () => {
      const history = [
        mk('a', 100, '餐飲', 1),
        mk('b', 200, '餐飲', 2),
        mk('c', 300, '餐飲', 3),
      ]
      // 99999 — both signals fire, expect digit_jump (more specific)
      const r = detectAmountOutlier({
        amount: 99999,
        category: '餐飲',
        expenses: history,
        now: NOW,
      })
      expect(r.kind).toBe('digit_jump')
    })
  })

  describe('history scoping', () => {
    it('only considers expenses with matching category (case-insensitive trim)', () => {
      const mixed = [
        mk('a', 100, '餐飲', 1),
        mk('b', 100, '餐飲 ', 2),
        mk('c', 100, 'CANTINA', 3),
        mk('other1', 5000, '購物', 1),
        mk('other2', 5000, '購物', 2),
        mk('other3', 5000, '購物', 3),
      ]
      const r = detectAmountOutlier({
        amount: 1500,
        category: ' 餐飲',
        expenses: mixed,
        now: NOW,
      })
      // Only 餐飲 (a + b) — sample = 2, below MIN_SAMPLE_SIZE → no outlier
      expect(r.sampleSize).toBe(2)
      expect(r.isOutlier).toBe(false)
    })

    it('excludes the expense being edited via excludeId', () => {
      const history = [
        mk('a', 100, '餐飲', 1),
        mk('b', 200, '餐飲', 2),
        mk('c', 300, '餐飲', 3),
        mk('editing', 50000, '餐飲', 0),
      ]
      const r = detectAmountOutlier({
        amount: 50000,
        category: '餐飲',
        expenses: history,
        now: NOW,
        excludeId: 'editing',
      })
      // Should fire because excluded record doesn't bias maxDigits upward
      expect(r.kind).toBe('digit_jump')
    })

    it('skips records with non-finite amounts', () => {
      const history = [
        mk('a', 100, '餐飲', 1),
        mk('b', 200, '餐飲', 2),
        mk('bad', NaN, '餐飲', 3),
        mk('c', 300, '餐飲', 4),
      ]
      const r = detectAmountOutlier({
        amount: 99999,
        category: '餐飲',
        expenses: history,
        now: NOW,
      })
      expect(r.kind).toBe('digit_jump')
      expect(r.sampleSize).toBe(3)
    })

    it('skips records with bad date gracefully', () => {
      const bad = { ...mk('bad', 100, '餐飲', 1), date: 'oops' } as unknown as Expense
      const ok = [
        mk('a', 100, '餐飲', 1),
        mk('b', 200, '餐飲', 2),
        mk('c', 300, '餐飲', 3),
      ]
      const r = detectAmountOutlier({
        amount: 99999,
        category: '餐飲',
        expenses: [bad, ...ok],
        now: NOW,
      })
      expect(r.kind).toBe('digit_jump')
      expect(r.sampleSize).toBe(3)
    })
  })

  describe('historicalMedian accuracy', () => {
    it('returns the median of historical amounts', () => {
      const history = [
        mk('a', 100, '餐飲', 1),
        mk('b', 200, '餐飲', 2),
        mk('c', 300, '餐飲', 3),
      ]
      const r = detectAmountOutlier({
        amount: 250,
        category: '餐飲',
        expenses: history,
        now: NOW,
      })
      expect(r.historicalMedian).toBe(200)
    })
  })
})

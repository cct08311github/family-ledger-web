/**
 * Unit tests for diffExpense — pure function, no Firebase dependency.
 * Target: 12-15 cases covering Issue #216 spec.
 */

// diffExpense imports formatEmailDate from email-notification; mock Firebase so the
// module can load without a real Firebase project.
jest.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }))
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}))
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import { diffExpense } from '@/lib/expense-diff'
import type { ExpenseSnapshot, ExpenseChange } from '@/lib/expense-diff'

// Helper to extract labels from a change list
function labels(changes: ExpenseChange[]): string[] {
  return changes.map((c) => c.label)
}

describe('diffExpense', () => {
  // 1. All identical fields → empty diff
  it('returns [] when before and after are identical', () => {
    const snap: ExpenseSnapshot = {
      description: '早餐',
      amount: 100,
      category: '餐飲',
      date: new Date('2026-04-19T00:00:00Z'),
      payerName: '爸爸',
      isShared: true,
      splitMethod: 'equal',
      paymentMethod: 'cash',
      note: '好吃',
    }
    expect(diffExpense(snap, { ...snap })).toEqual([])
  })

  // 2. Only amount changed
  it('detects amount change with NT$ formatted values', () => {
    const changes = diffExpense({ amount: 100 }, { amount: 200 })
    expect(labels(changes)).toEqual(['金額'])
    expect(changes[0].from).toBe('NT$ 100')
    expect(changes[0].to).toBe('NT$ 200')
  })

  // 3. Only description changed
  it('detects description change', () => {
    const changes = diffExpense({ description: '早餐' }, { description: '早午餐' })
    expect(labels(changes)).toEqual(['描述'])
    expect(changes[0].from).toBe('早餐')
    expect(changes[0].to).toBe('早午餐')
  })

  // 4a. Category changed from value to value
  it('detects category change', () => {
    const changes = diffExpense({ category: '餐飲' }, { category: '外食' })
    expect(labels(changes)).toEqual(['類別'])
    expect(changes[0].from).toBe('餐飲')
    expect(changes[0].to).toBe('外食')
  })

  // 4b. Category empty → value ('' treated as absent)
  it('detects category change from empty string to value', () => {
    const changes = diffExpense({ category: '' }, { category: '餐飲' })
    expect(labels(changes)).toEqual(['類別'])
    expect(changes[0].from).toBe('（無）')
    expect(changes[0].to).toBe('餐飲')
  })

  // 4c. Category value → empty string
  it('detects category change from value to empty string', () => {
    const changes = diffExpense({ category: '餐飲' }, { category: '' })
    expect(labels(changes)).toEqual(['類別'])
    expect(changes[0].from).toBe('餐飲')
    expect(changes[0].to).toBe('（無）')
  })

  // 5. isShared toggled
  it('detects isShared toggle true → false', () => {
    const changes = diffExpense({ isShared: true }, { isShared: false })
    expect(labels(changes)).toEqual(['類型'])
    expect(changes[0].from).toBe('共同')
    expect(changes[0].to).toBe('個人')
  })

  it('detects isShared toggle false → true', () => {
    const changes = diffExpense({ isShared: false }, { isShared: true })
    expect(changes[0].from).toBe('個人')
    expect(changes[0].to).toBe('共同')
  })

  // 6. paymentMethod change renders via paymentLabel mapping
  it('detects paymentMethod change with Chinese labels', () => {
    const changes = diffExpense({ paymentMethod: 'cash' }, { paymentMethod: 'creditCard' })
    expect(labels(changes)).toEqual(['付款方式'])
    expect(changes[0].from).toBe('現金')
    expect(changes[0].to).toBe('信用卡')
  })

  // 7. Date change via Firestore-style Timestamp object → compared correctly
  it('detects date change (Timestamp-like objects)', () => {
    const d1 = { toDate: () => new Date('2026-04-18T00:00:00Z') }
    const d2 = { toDate: () => new Date('2026-04-19T00:00:00Z') }
    const changes = diffExpense({ date: d1 }, { date: d2 })
    expect(labels(changes)).toEqual(['日期'])
    // Formatted as YYYY-MM-DD in Asia/Taipei
    expect(changes[0].from).toMatch(/2026-04-1[89]/)
    expect(changes[0].to).toMatch(/2026-04-1[89]/)
  })

  // 8. Same-day date but different timestamp → should NOT be a change (same getTime())
  it('does not flag a change when before and after date have the same timestamp', () => {
    const ts = new Date('2026-04-19T08:00:00Z')
    const changes = diffExpense({ date: ts }, { date: new Date(ts.getTime()) })
    expect(changes).toEqual([])
  })

  // 9a. Note null / undefined / '' are all equivalent → no change
  it('treats null, undefined, and empty string note as equivalent', () => {
    expect(diffExpense({ note: null }, { note: undefined })).toEqual([])
    expect(diffExpense({ note: undefined }, { note: '' })).toEqual([])
    expect(diffExpense({ note: null }, { note: '' })).toEqual([])
  })

  // 9b. '' → 'hello' IS a change
  it('detects note change from empty to non-empty', () => {
    const changes = diffExpense({ note: '' }, { note: '好吃' })
    expect(labels(changes)).toEqual(['備註'])
    expect(changes[0].from).toBe('（無）')
    expect(changes[0].to).toBe('好吃')
  })

  // 10. Multiple simultaneous changes in stable order
  it('returns multiple changes in field iteration order', () => {
    const before: ExpenseSnapshot = { description: '早餐', amount: 100, category: '餐飲' }
    const after: ExpenseSnapshot = { description: '早午餐', amount: 200, category: '外食' }
    const changes = diffExpense(before, after)
    expect(labels(changes)).toEqual(['描述', '金額', '類別'])
  })

  // 11. Missing field in before (undefined) → rendered as '（無）'
  it('renders undefined before field as （無）', () => {
    const changes = diffExpense({}, { category: '餐飲' })
    expect(labels(changes)).toEqual(['類別'])
    expect(changes[0].from).toBe('（無）')
    expect(changes[0].to).toBe('餐飲')
  })

  // 12. Splits are never in the diff output
  it('does not produce any split-related entry even if snapshots differ', () => {
    // ExpenseSnapshot intentionally has no splits field;
    // this test confirms diffExpense never outputs a splits label.
    const changes = diffExpense(
      { description: '午餐', amount: 150 },
      { description: '午餐', amount: 150 },
    )
    const hasSpliLabel = changes.some((c) => c.label.includes('分攤') || c.label.includes('split'))
    expect(hasSpliLabel).toBe(false)
    expect(changes).toEqual([])
  })

  // 13. Null amount in before → （無）
  it('renders null amount before as （無）', () => {
    const changes = diffExpense({ amount: null }, { amount: 300 })
    expect(labels(changes)).toEqual(['金額'])
    expect(changes[0].from).toBe('（無）')
    expect(changes[0].to).toBe('NT$ 300')
  })

  // 14. splitMethod change
  it('detects splitMethod change', () => {
    const changes = diffExpense({ splitMethod: 'equal' }, { splitMethod: 'custom' })
    expect(labels(changes)).toEqual(['分帳方式'])
    expect(changes[0].from).toBe('equal')
    expect(changes[0].to).toBe('custom')
  })

  // 15. payerName change
  it('detects payerName change', () => {
    const changes = diffExpense({ payerName: '爸爸' }, { payerName: '媽媽' })
    expect(labels(changes)).toEqual(['付款人'])
    expect(changes[0].from).toBe('爸爸')
    expect(changes[0].to).toBe('媽媽')
  })
})

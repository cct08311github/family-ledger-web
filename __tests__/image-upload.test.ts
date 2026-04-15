jest.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }))
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  deleteObject: jest.fn(),
}))

import { normalizeReceiptPaths, MAX_RECEIPTS_PER_EXPENSE } from '@/lib/services/image-upload'

describe('normalizeReceiptPaths', () => {
  it('returns receiptPaths when present and non-empty', () => {
    expect(normalizeReceiptPaths({ receiptPaths: ['a', 'b'] })).toEqual(['a', 'b'])
  })

  it('falls back to legacy receiptPath when receiptPaths is empty', () => {
    expect(normalizeReceiptPaths({ receiptPaths: [], receiptPath: 'legacy.jpg' })).toEqual(['legacy.jpg'])
  })

  it('falls back to legacy receiptPath when receiptPaths is undefined', () => {
    expect(normalizeReceiptPaths({ receiptPath: 'legacy.jpg' })).toEqual(['legacy.jpg'])
  })

  it('returns empty array when no receipts exist', () => {
    expect(normalizeReceiptPaths({})).toEqual([])
    expect(normalizeReceiptPaths({ receiptPath: null })).toEqual([])
    expect(normalizeReceiptPaths({ receiptPaths: [] })).toEqual([])
  })

  it('prefers new receiptPaths over legacy receiptPath when both present', () => {
    expect(
      normalizeReceiptPaths({ receiptPaths: ['new.jpg'], receiptPath: 'old.jpg' }),
    ).toEqual(['new.jpg'])
  })
})

describe('MAX_RECEIPTS_PER_EXPENSE', () => {
  it('is set to 10 per spec', () => {
    expect(MAX_RECEIPTS_PER_EXPENSE).toBe(10)
  })
})

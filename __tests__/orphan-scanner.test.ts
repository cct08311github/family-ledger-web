jest.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }))
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), getDocs: jest.fn() }))
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  deleteObject: jest.fn(),
  getMetadata: jest.fn(),
  listAll: jest.fn(),
}))

import { computeOrphanPaths } from '@/lib/services/orphan-scanner'

describe('computeOrphanPaths', () => {
  it('returns storage paths not referenced by any expense', () => {
    const storage = [
      'receipts/g1/e1/a.jpg',
      'receipts/g1/e1/b.jpg',
      'receipts/g1/e2/c.jpg',
      'receipts/g1/orphan/d.jpg',
    ]
    const referenced = new Set(['receipts/g1/e1/a.jpg', 'receipts/g1/e2/c.jpg'])
    expect(computeOrphanPaths(storage, referenced)).toEqual([
      'receipts/g1/e1/b.jpg',
      'receipts/g1/orphan/d.jpg',
    ])
  })

  it('returns all storage paths when nothing is referenced', () => {
    const storage = ['receipts/g1/e1/a.jpg', 'receipts/g1/e2/b.jpg']
    expect(computeOrphanPaths(storage, new Set())).toEqual(storage)
  })

  it('returns empty array when all storage paths are referenced', () => {
    const storage = ['receipts/g1/e1/a.jpg']
    const referenced = new Set(['receipts/g1/e1/a.jpg'])
    expect(computeOrphanPaths(storage, referenced)).toEqual([])
  })

  it('handles empty storage list', () => {
    expect(computeOrphanPaths([], new Set(['receipts/g1/e1/a.jpg']))).toEqual([])
  })

  it('treats paths with matching names under different groups as distinct', () => {
    const storage = ['receipts/g1/e1/a.jpg', 'receipts/g2/e1/a.jpg']
    const referenced = new Set(['receipts/g1/e1/a.jpg'])
    // Scanner scopes input to a single group in practice, but the diff helper
    // is path-exact — confirm no accidental substring matching.
    expect(computeOrphanPaths(storage, referenced)).toEqual(['receipts/g2/e1/a.jpg'])
  })
})

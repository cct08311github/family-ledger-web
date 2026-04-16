jest.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }))
const mockGetDocs = jest.fn()
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}))
const mockDeleteObject = jest.fn()
jest.mock('firebase/storage', () => ({
  ref: jest.fn((_storage, path: string) => ({ fullPath: path })),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  getMetadata: jest.fn(),
  listAll: jest.fn(),
}))

import { computeOrphanPaths, deleteOrphans } from '@/lib/services/orphan-scanner'

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

describe('deleteOrphans', () => {
  beforeEach(() => {
    mockGetDocs.mockReset()
    mockDeleteObject.mockReset()
  })

  function stubGetDocs(expenses: Array<{ receiptPaths?: string[]; receiptPath?: string | null }>) {
    mockGetDocs.mockResolvedValueOnce({
      docs: expenses.map((e) => ({ data: () => e })),
    })
  }

  it('deletes paths that are still orphans', async () => {
    stubGetDocs([{ receiptPaths: [] }])
    mockDeleteObject.mockResolvedValue(undefined)
    const result = await deleteOrphans('g1', ['receipts/g1/e1/a.jpg', 'receipts/g1/e2/b.jpg'])
    expect(result.succeeded).toHaveLength(2)
    expect(result.failed).toEqual([])
    expect(result.adopted).toEqual([])
    expect(mockDeleteObject).toHaveBeenCalledTimes(2)
  })

  it('skips paths adopted by an expense between scan and delete', async () => {
    // 'a.jpg' got adopted after the scan
    stubGetDocs([{ receiptPaths: ['receipts/g1/e1/a.jpg'] }])
    mockDeleteObject.mockResolvedValue(undefined)
    const result = await deleteOrphans('g1', ['receipts/g1/e1/a.jpg', 'receipts/g1/e2/b.jpg'])
    expect(result.adopted).toEqual(['receipts/g1/e1/a.jpg'])
    expect(result.succeeded).toEqual(['receipts/g1/e2/b.jpg'])
    // Only the still-orphan path hits deleteObject.
    expect(mockDeleteObject).toHaveBeenCalledTimes(1)
  })

  it('collects per-path failures without aborting the batch', async () => {
    stubGetDocs([{ receiptPaths: [] }])
    mockDeleteObject
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)
    const result = await deleteOrphans('g1', ['receipts/g1/e1/a.jpg', 'receipts/g1/e2/b.jpg'])
    expect(result.succeeded).toEqual(['receipts/g1/e2/b.jpg'])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].path).toBe('receipts/g1/e1/a.jpg')
  })

  it('recognizes legacy receiptPath (singular) as adopting a path', async () => {
    stubGetDocs([{ receiptPath: 'receipts/g1/e1/legacy.jpg' }])
    const result = await deleteOrphans('g1', ['receipts/g1/e1/legacy.jpg'])
    expect(result.adopted).toEqual(['receipts/g1/e1/legacy.jpg'])
    expect(result.succeeded).toEqual([])
    expect(mockDeleteObject).not.toHaveBeenCalled()
  })
})

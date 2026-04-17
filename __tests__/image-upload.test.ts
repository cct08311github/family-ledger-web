jest.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }))
const mockUploadBytes = jest.fn()
jest.mock('firebase/storage', () => ({
  ref: jest.fn((_storage, path: string) => ({ fullPath: path })),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  deleteObject: jest.fn(),
}))

import {
  normalizeReceiptPaths,
  MAX_RECEIPTS_PER_EXPENSE,
  uploadReceiptImages,
} from '@/lib/services/image-upload'

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

describe('uploadReceiptImages onProgress', () => {
  beforeEach(() => {
    mockUploadBytes.mockReset()
  })

  function nonImageFile(name: string): File {
    // text/plain short-circuits compressImage (non-image branch) so tests don't
    // touch canvas/DOM APIs that aren't available in jsdom.
    return new File(['stub'], name, { type: 'text/plain' })
  }

  it('fires onProgress after each file with cumulative counts', async () => {
    mockUploadBytes.mockResolvedValue(undefined)
    const files = [nonImageFile('a.txt'), nonImageFile('b.txt'), nonImageFile('c.txt')]
    const progress: Array<[number, number]> = []
    await uploadReceiptImages('g1', 'e1', files, 'uid', (current, total) => {
      progress.push([current, total])
    })
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })

  it('works without onProgress (backwards-compatible)', async () => {
    mockUploadBytes.mockResolvedValue(undefined)
    const files = [nonImageFile('a.txt')]
    await expect(uploadReceiptImages('g1', 'e1', files, 'uid')).resolves.toEqual({
      paths: expect.any(Array),
    })
  })

  it('does not call onProgress after a failed upload', async () => {
    mockUploadBytes
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network'))
    const files = [nonImageFile('a.txt'), nonImageFile('b.txt'), nonImageFile('c.txt')]
    const progress: Array<[number, number]> = []
    await expect(
      uploadReceiptImages('g1', 'e1', files, 'uid', (c, t) => progress.push([c, t])),
    ).rejects.toThrow()
    // First file succeeded → one tick. Failure on 2nd aborts before tick for it.
    expect(progress).toEqual([[1, 3]])
  })
})

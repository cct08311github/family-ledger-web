// Verifies the observability behavior added by Issue #172 to deleteGroup:
// errors on subcollection reads must be logged (not silently swallowed) while
// still allowing the rest of the deletion to proceed.

jest.mock('@/lib/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u1' } } }))

const mockGetDocs = jest.fn()
const mockBatchDelete = jest.fn()
const mockBatchCommit = jest.fn().mockResolvedValue(undefined)
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  arrayRemove: jest.fn(),
  arrayUnion: jest.fn(),
  collection: jest.fn((_db, ..._segments: string[]) => ({ _type: 'collection', segments: _segments })),
  doc: jest.fn((..._args: unknown[]) => ({ _type: 'docRef' })),
  updateDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn(),
  where: jest.fn(),
  Timestamp: { now: jest.fn(() => ({ _type: 'ts' })) },
  writeBatch: jest.fn(() => ({
    delete: mockBatchDelete,
    commit: mockBatchCommit,
    // Self-defending: if SUT unexpectedly calls set() in the delete path, fail loudly.
    set: jest.fn(() => {
      throw new Error('deleteGroup should not call batch.set()')
    }),
  })),
}))

const mockLoggerWarn = jest.fn()
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

import { deleteGroup } from '@/lib/services/group-service'

describe('deleteGroup subcollection read failure observability (Issue #172)', () => {
  beforeEach(() => {
    mockGetDocs.mockReset()
    mockBatchDelete.mockReset()
    mockBatchCommit.mockReset().mockResolvedValue(undefined)
    mockLoggerWarn.mockReset()
  })

  it('logs a warning for each subcollection whose read fails, then a summary', async () => {
    // Simulate: members reads ok, categories + expenses throw, rest ok
    mockGetDocs
      // members
      .mockResolvedValueOnce({ docs: [{ ref: { _type: 'docRef', id: 'm1' } }] })
      // categories — throws
      .mockRejectedValueOnce(new Error('network blip'))
      // expenses — throws
      .mockRejectedValueOnce(new Error('rate limit'))
      // settlements / notifications / userPreferences — empty
      .mockResolvedValue({ docs: [] })

    await deleteGroup('g1')

    // Each failed subcollection gets its own warning + one summary warning.
    // 2 per-failure warnings + 1 summary = 3 calls.
    expect(mockLoggerWarn).toHaveBeenCalledTimes(3)

    // The summary must list both skipped subcollections so an operator scanning
    // logs sees the full picture of potentially orphaned data.
    const summaryCall = mockLoggerWarn.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('completed with skipped'),
    )
    if (!summaryCall) {
      throw new Error('Expected a "completed with skipped" summary warning but none was emitted')
    }
    const summaryContext = summaryCall[1] as { groupId: string; skipped: string[] }
    expect(summaryContext.groupId).toBe('g1')
    // Copy before sort — don't mutate the array held by the mock call record,
    // which would corrupt any later assertion against the same call.
    expect([...summaryContext.skipped].sort()).toEqual(['categories', 'expenses'])
  })

  it('does not log when all subcollection reads succeed', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    await deleteGroup('g1')
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('still proceeds to delete the rest even when some subcollections fail', async () => {
    mockGetDocs
      .mockResolvedValueOnce({ docs: [{ ref: { _type: 'docRef', id: 'm1' } }] })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ docs: [] })

    await deleteGroup('g1')

    // The batch still commits — deletion is NOT aborted by the partial failure.
    expect(mockBatchCommit).toHaveBeenCalled()
  })
})

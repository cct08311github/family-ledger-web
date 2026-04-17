// Dedicated file for pruneStaleRules (Issue #167), separate from the main
// transaction-rules-service.test.ts to limit merge conflicts.

jest.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }))

const mockGetDocs = jest.fn()
const mockDeleteDoc = jest.fn()
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(() => ({ _type: 'collection' })),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: jest.fn((..._args: unknown[]) => ({ _type: 'docRef' })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
  Timestamp: { fromDate: jest.fn() },
}))

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import {
  pruneStaleRules,
  TRANSACTION_RULE_MIN_HITS,
  STALE_RULE_DAYS,
} from '@/lib/services/transaction-rules-service'

/** Build a fake Firestore timestamp that survives toMillis(). */
function ts(date: Date) {
  return { toMillis: () => date.getTime() }
}

describe('pruneStaleRules (Issue #167)', () => {
  beforeEach(() => {
    mockGetDocs.mockReset()
    mockDeleteDoc.mockReset()
  })

  function stubRules(rules: Array<{ id: string; hitCount: number; lastUsed: Date }>) {
    mockGetDocs.mockResolvedValueOnce({
      docs: rules.map((r) => ({
        id: r.id,
        data: () => ({
          pattern: 'p',
          category: 'c',
          hitCount: r.hitCount,
          lastUsed: ts(r.lastUsed),
          createdAt: ts(r.lastUsed),
        }),
      })),
    })
  }

  it('returns an empty result for empty groupId without touching Firestore', async () => {
    const r = await pruneStaleRules('')
    expect(r).toEqual({ scanned: 0, pruned: 0, kept: 0, failed: 0 })
    expect(mockGetDocs).not.toHaveBeenCalled()
  })

  it('prunes only rules that are BOTH below threshold AND older than cutoff', async () => {
    const NOW = Date.now()
    const oldIdle = new Date(NOW - (STALE_RULE_DAYS + 10) * 86400000)
    const recentIdle = new Date(NOW - 5 * 86400000)

    stubRules([
      { id: 'r1', hitCount: 1, lastUsed: oldIdle }, // prune
      { id: 'r2', hitCount: 2, lastUsed: oldIdle }, // prune (< threshold of 3)
      { id: 'r3', hitCount: TRANSACTION_RULE_MIN_HITS, lastUsed: oldIdle }, // KEEP — active
      { id: 'r4', hitCount: 1, lastUsed: recentIdle }, // KEEP — recent
      { id: 'r5', hitCount: TRANSACTION_RULE_MIN_HITS + 10, lastUsed: oldIdle }, // KEEP — active, high count
    ])
    mockDeleteDoc.mockResolvedValue(undefined)

    const result = await pruneStaleRules('g1')

    expect(result.scanned).toBe(5)
    expect(result.pruned).toBe(2)
    expect(result.kept).toBe(3)
    expect(result.failed).toBe(0)
    expect(mockDeleteDoc).toHaveBeenCalledTimes(2)
  })

  it('NEVER prunes rules at or above the suggestion threshold regardless of age', async () => {
    // Rule hitCount == threshold, idle for 1000 days — still kept.
    const veryOld = new Date(Date.now() - 1000 * 86400000)
    stubRules([
      { id: 'r1', hitCount: TRANSACTION_RULE_MIN_HITS, lastUsed: veryOld },
    ])
    const result = await pruneStaleRules('g1')
    expect(result.pruned).toBe(0)
    expect(result.kept).toBe(1)
    expect(mockDeleteDoc).not.toHaveBeenCalled()
  })

  it('counts per-deletion failures without aborting', async () => {
    const oldIdle = new Date(Date.now() - (STALE_RULE_DAYS + 10) * 86400000)
    stubRules([
      { id: 'r1', hitCount: 1, lastUsed: oldIdle },
      { id: 'r2', hitCount: 1, lastUsed: oldIdle },
    ])
    mockDeleteDoc
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)
    const result = await pruneStaleRules('g1')
    expect(result.pruned).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.kept).toBe(0) // 2 scanned, 1 pruned, 1 failed → 0 kept
  })

  it('re-throws Firebase auth errors from deleteDoc', async () => {
    const oldIdle = new Date(Date.now() - (STALE_RULE_DAYS + 10) * 86400000)
    stubRules([{ id: 'r1', hitCount: 1, lastUsed: oldIdle }])
    const authErr = Object.assign(new Error('denied'), { code: 'permission-denied' })
    mockDeleteDoc.mockRejectedValueOnce(authErr)
    await expect(pruneStaleRules('g1')).rejects.toBe(authErr)
  })

  it('handles missing lastUsed (legacy data) by treating it as very old', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{
        id: 'r1',
        data: () => ({ pattern: 'p', category: 'c', hitCount: 1 }),
      }],
    })
    mockDeleteDoc.mockResolvedValue(undefined)
    const result = await pruneStaleRules('g1')
    // Missing lastUsed → lastUsedMs = 0, which is older than any cutoff → prune.
    expect(result.pruned).toBe(1)
  })

  it('honors a custom staleDays parameter', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000)
    stubRules([{ id: 'r1', hitCount: 1, lastUsed: twoDaysAgo }])
    // With 1-day cutoff, r1 IS stale (2 > 1).
    mockDeleteDoc.mockResolvedValue(undefined)
    const result = await pruneStaleRules('g1', 1)
    expect(result.pruned).toBe(1)
  })
})

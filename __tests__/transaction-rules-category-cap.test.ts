// Dedicated file for the category-length defense-in-depth guard (Issue #165).
// Lives separately from the forthcoming transaction-rules-service.test.ts
// (PR #163) to avoid merge conflicts. When that PR lands, this file can be
// folded into the main test suite.

jest.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }))

const mockAddDoc = jest.fn()
const mockGetDocs = jest.fn()
const mockUpdateDoc = jest.fn()
jest.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  collection: jest.fn(() => ({ _type: 'collection' })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn((...c: unknown[]) => ({ _type: 'query', c })),
  serverTimestamp: jest.fn(() => ({ _type: 'serverTimestamp' })),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  where: jest.fn(() => ({ _type: 'where' })),
  Timestamp: { fromDate: jest.fn() },
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

import { learnFromExpense } from '@/lib/services/transaction-rules-service'

describe('learnFromExpense category length cap (Issue #165)', () => {
  beforeEach(() => {
    mockAddDoc.mockReset()
    mockGetDocs.mockReset()
    mockUpdateDoc.mockReset()
    mockLoggerWarn.mockReset()
  })

  it('accepts categories exactly at the 30-char limit', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] })
    mockAddDoc.mockResolvedValueOnce({ id: 'r1' })
    const thirtyCharCategory = 'a'.repeat(30)
    await learnFromExpense('g1', 'coffee', thirtyCharCategory)
    expect(mockAddDoc).toHaveBeenCalledTimes(1)
    // No warning for the happy path.
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('rejects categories exceeding 30 chars early and warns for observability', async () => {
    const tooLong = 'a'.repeat(31)
    await learnFromExpense('g1', 'coffee', tooLong)
    expect(mockGetDocs).not.toHaveBeenCalled()
    expect(mockAddDoc).not.toHaveBeenCalled()
    expect(mockUpdateDoc).not.toHaveBeenCalled()
    // Must surface as a warning so system_logs catches likely programming errors.
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
  })

  it('rejects obviously malicious 1MB category without any Firestore call', async () => {
    // The original security concern from PR #163 review: a malicious client
    // could flood transactionRules with huge category payloads. Defense-in-depth
    // catches it before the network round-trip.
    const oneMB = 'x'.repeat(1024 * 1024)
    await learnFromExpense('g1', 'coffee', oneMB)
    expect(mockGetDocs).not.toHaveBeenCalled()
    expect(mockAddDoc).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
  })
})

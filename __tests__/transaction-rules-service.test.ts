jest.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }))

const mockAddDoc = jest.fn()
const mockGetDocs = jest.fn()
const mockUpdateDoc = jest.fn()
jest.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  collection: jest.fn((_db, ..._segments: string[]) => ({ _type: 'collection' })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn((...clauses: unknown[]) => ({ _type: 'query', clauses })),
  serverTimestamp: jest.fn(() => ({ _type: 'serverTimestamp' })),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  where: jest.fn((field: string, op: string, value: unknown) => ({ _type: 'where', field, op, value })),
  Timestamp: { fromDate: jest.fn((d: Date) => ({ _type: 'timestamp', iso: d.toISOString() })) },
}))

// Silence logger noise during expected error paths without asserting on calls.
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import {
  normalizePattern,
  learnFromExpense,
  suggestCategory,
  TRANSACTION_RULE_MIN_HITS,
} from '@/lib/services/transaction-rules-service'

// --- normalizePattern ------------------------------------------------------

describe('normalizePattern', () => {
  it('lowercases and trims the description', () => {
    expect(normalizePattern('  Starbucks Coffee  ')).toBe('starbucks coffee')
  })

  it('collapses internal runs of whitespace into a single space', () => {
    expect(normalizePattern('a   b\tc')).toBe('a b c')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizePattern('   \n\t  ')).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(normalizePattern('')).toBe('')
  })

  it('preserves non-ASCII characters (Traditional Chinese expected in this app)', () => {
    expect(normalizePattern('  星巴克 咖啡 ')).toBe('星巴克 咖啡')
  })
})

// --- learnFromExpense ------------------------------------------------------

describe('learnFromExpense', () => {
  beforeEach(() => {
    mockAddDoc.mockReset()
    mockGetDocs.mockReset()
    mockUpdateDoc.mockReset()
  })

  function stubGetDocs(docs: Array<{ id?: string; data: Record<string, unknown> }>) {
    mockGetDocs.mockResolvedValueOnce({
      empty: docs.length === 0,
      docs: docs.map((d, i) => ({
        id: d.id ?? `doc-${i}`,
        ref: { _type: 'docRef', id: d.id ?? `doc-${i}` },
        data: () => d.data,
      })),
    })
  }

  it('is a no-op when inputs are empty (no Firestore calls at all)', async () => {
    await learnFromExpense('', 'coffee', '餐飲')
    await learnFromExpense('g1', '', '餐飲')
    await learnFromExpense('g1', 'coffee', '')
    expect(mockGetDocs).not.toHaveBeenCalled()
    expect(mockAddDoc).not.toHaveBeenCalled()
    expect(mockUpdateDoc).not.toHaveBeenCalled()
  })

  it('creates a new rule with hitCount=1 and timestamps when no existing rule matches', async () => {
    stubGetDocs([])
    mockAddDoc.mockResolvedValueOnce({ id: 'new-rule' })

    await learnFromExpense('g1', '星巴克', '餐飲')

    expect(mockAddDoc).toHaveBeenCalledTimes(1)
    const addedData = mockAddDoc.mock.calls[0][1]
    expect(addedData).toMatchObject({
      pattern: '星巴克',
      category: '餐飲',
      hitCount: 1,
    })
    // Timestamps must be set for both fields — a regression removing either
    // would break freshness-based rule pruning downstream.
    expect(addedData).toHaveProperty('createdAt')
    expect(addedData).toHaveProperty('lastUsed')
    expect(mockUpdateDoc).not.toHaveBeenCalled()
  })

  it('increments hitCount AND refreshes lastUsed on the existing rule when matched', async () => {
    stubGetDocs([{ id: 'r1', data: { pattern: 'coffee', category: '餐飲', hitCount: 2 } }])
    mockUpdateDoc.mockResolvedValueOnce(undefined)

    await learnFromExpense('g1', 'coffee', '餐飲')

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const updatedData = mockUpdateDoc.mock.calls[0][1]
    expect(updatedData.hitCount).toBe(3)
    // lastUsed must be refreshed so "recently used" rules can be prioritized later.
    expect(updatedData).toHaveProperty('lastUsed')
    expect(mockAddDoc).not.toHaveBeenCalled()
  })

  it('normalizes the description before querying', async () => {
    stubGetDocs([])
    mockAddDoc.mockResolvedValueOnce({ id: 'new-rule' })

    await learnFromExpense('g1', '  STARBUCKS  ', '餐飲')

    const addedData = mockAddDoc.mock.calls[0][1]
    expect(addedData.pattern).toBe('starbucks')
  })

  it('swallows Firestore getDocs errors (best-effort, must not break the expense save path)', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('firestore unavailable'))
    await expect(learnFromExpense('g1', 'coffee', '餐飲')).resolves.toBeUndefined()
    expect(mockAddDoc).not.toHaveBeenCalled()
  })

  it('swallows addDoc errors in the create branch', async () => {
    // Specifically covers the new-rule creation path's catch block — a future
    // refactor that re-throws from addDoc would silently break the
    // non-fatal contract without this test.
    stubGetDocs([])
    mockAddDoc.mockRejectedValueOnce(new Error('quota exceeded'))
    await expect(learnFromExpense('g1', 'coffee', '餐飲')).resolves.toBeUndefined()
  })

  it('swallows updateDoc errors in the increment branch', async () => {
    stubGetDocs([{ id: 'r1', data: { pattern: 'coffee', category: '餐飲', hitCount: 2 } }])
    mockUpdateDoc.mockRejectedValueOnce(new Error('permission denied'))
    await expect(learnFromExpense('g1', 'coffee', '餐飲')).resolves.toBeUndefined()
  })
})

// --- suggestCategory -------------------------------------------------------

describe('suggestCategory', () => {
  beforeEach(() => {
    mockGetDocs.mockReset()
  })

  function stubRules(rules: Array<{ category: string; hitCount: number }>) {
    mockGetDocs.mockResolvedValueOnce({
      empty: rules.length === 0,
      docs: rules.map((r, i) => ({ id: `r${i}`, data: () => r })),
    })
  }

  it('returns null for empty description', async () => {
    await expect(suggestCategory('g1', '')).resolves.toBeNull()
    expect(mockGetDocs).not.toHaveBeenCalled()
  })

  it('returns null for patterns shorter than 2 characters (after normalization)', async () => {
    await expect(suggestCategory('g1', 'a')).resolves.toBeNull()
    await expect(suggestCategory('g1', '  b  ')).resolves.toBeNull()
    expect(mockGetDocs).not.toHaveBeenCalled()
  })

  it('returns null for empty groupId', async () => {
    await expect(suggestCategory('', 'coffee')).resolves.toBeNull()
    expect(mockGetDocs).not.toHaveBeenCalled()
  })

  it('returns null when no rules match the pattern', async () => {
    stubRules([])
    await expect(suggestCategory('g1', 'coffee')).resolves.toBeNull()
  })

  it('returns null when all matches are below MIN_HIT_COUNT_FOR_SUGGESTION', async () => {
    stubRules([
      { category: '餐飲', hitCount: TRANSACTION_RULE_MIN_HITS - 1 },
      { category: '娛樂', hitCount: 1 },
    ])
    await expect(suggestCategory('g1', 'coffee')).resolves.toBeNull()
  })

  it('returns the category of a single above-threshold rule', async () => {
    stubRules([{ category: '餐飲', hitCount: TRANSACTION_RULE_MIN_HITS }])
    await expect(suggestCategory('g1', 'coffee')).resolves.toBe('餐飲')
  })

  it('picks the category with the highest hitCount when multiple rules exceed threshold', async () => {
    stubRules([
      { category: '餐飲', hitCount: TRANSACTION_RULE_MIN_HITS + 2 },
      { category: '娛樂', hitCount: TRANSACTION_RULE_MIN_HITS + 5 }, // winner
      { category: '購物', hitCount: TRANSACTION_RULE_MIN_HITS + 1 },
    ])
    await expect(suggestCategory('g1', 'coffee')).resolves.toBe('娛樂')
  })

  it('ignores sub-threshold rules even when they would otherwise win by hitCount', async () => {
    // Sub-threshold rule has more hits than the valid one — must still be skipped.
    stubRules([
      { category: '娛樂', hitCount: TRANSACTION_RULE_MIN_HITS - 1 }, // higher but ineligible (假設 threshold > 2)
      { category: '餐飲', hitCount: TRANSACTION_RULE_MIN_HITS },
    ])
    await expect(suggestCategory('g1', 'coffee')).resolves.toBe('餐飲')
  })

  it('first-encountered wins when two rules tie on max hitCount', async () => {
    // SUT uses strict `>`, so the first rule in Firestore iteration order keeps
    // the winning slot. This test documents the current behavior — if tie-breaking
    // is intentionally changed (e.g., tie-break by lastUsed), this test will
    // fail and force an explicit decision.
    stubRules([
      { category: '餐飲', hitCount: TRANSACTION_RULE_MIN_HITS + 3 },
      { category: '娛樂', hitCount: TRANSACTION_RULE_MIN_HITS + 3 },
    ])
    await expect(suggestCategory('g1', 'coffee')).resolves.toBe('餐飲')
  })

  it('skips docs with missing hitCount rather than crashing (defensive)', async () => {
    // Firestore data coming back without hitCount shouldn't blow up max-picking.
    // (SUT checks `data.hitCount < MIN` — undefined < N is false, so it's skipped.)
    stubRules([
      { category: '娛樂' } as unknown as { category: string; hitCount: number },
      { category: '餐飲', hitCount: TRANSACTION_RULE_MIN_HITS },
    ])
    await expect(suggestCategory('g1', 'coffee')).resolves.toBe('餐飲')
  })

  it('swallows Firestore errors and returns null', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('firestore unavailable'))
    await expect(suggestCategory('g1', 'coffee')).resolves.toBeNull()
  })
})

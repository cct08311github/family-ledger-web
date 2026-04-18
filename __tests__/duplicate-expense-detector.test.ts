import {
  findPossibleDuplicate,
  DEFAULT_WINDOW_MINUTES,
  type DuplicateCandidate,
  type RecentExpenseLike,
} from '@/lib/duplicate-expense-detector'

// Simulated "now" — 2026-04-18 12:00:00 local
const NOW = new Date(2026, 3, 18, 12, 0, 0).getTime()

const MIN = 60_000

function rec(
  id: string,
  description: string,
  amount: number,
  minutesAgo: number,
  payerName = '爸爸',
): RecentExpenseLike {
  return {
    id,
    description,
    amount,
    payerName,
    createdAt: new Date(NOW - minutesAgo * MIN),
  }
}

function cand(description: string, amount: number, isEditingId?: string): DuplicateCandidate {
  return { description, amount, isEditingId }
}

describe('findPossibleDuplicate', () => {
  it('returns null on empty recent list', () => {
    expect(findPossibleDuplicate(cand('電費', 1200), [], NOW)).toBeNull()
  })

  it('matches exact description + amount inside the window', () => {
    const recent = [rec('e1', '電費', 1200, 2)]
    const hit = findPossibleDuplicate(cand('電費', 1200), recent, NOW)
    expect(hit?.id).toBe('e1')
  })

  it('matches when candidate description contains recent description', () => {
    // User typed "電費 4 月" after partner recorded plain "電費"; same amount.
    const recent = [rec('e1', '電費', 1200, 1)]
    const hit = findPossibleDuplicate(cand('電費 4 月', 1200), recent, NOW)
    expect(hit?.id).toBe('e1')
  })

  it('matches when recent description contains candidate description', () => {
    // Reverse — user typed short "電費" but partner recorded verbose "電費 4 月".
    const recent = [rec('e1', '電費 4 月', 1200, 1)]
    const hit = findPossibleDuplicate(cand('電費', 1200), recent, NOW)
    expect(hit?.id).toBe('e1')
  })

  it('trims whitespace on both sides before comparing', () => {
    const recent = [rec('e1', '電費', 1200, 1)]
    expect(findPossibleDuplicate(cand('  電費 ', 1200), recent, NOW)).not.toBeNull()
  })

  it('case-insensitive for latin text', () => {
    const recent = [rec('e1', 'Starbucks', 150, 1)]
    expect(findPossibleDuplicate(cand('STARBUCKS', 150), recent, NOW)).not.toBeNull()
  })

  it('rejects when amount differs', () => {
    const recent = [rec('e1', '電費', 1200, 1)]
    expect(findPossibleDuplicate(cand('電費', 1199), recent, NOW)).toBeNull()
  })

  it('rejects when description is unrelated', () => {
    const recent = [rec('e1', '電費', 1200, 1)]
    expect(findPossibleDuplicate(cand('早餐', 1200), recent, NOW)).toBeNull()
  })

  it('rejects when candidate description is too short to match meaningfully', () => {
    // A single char matching many things is noise — require at least 2 chars
    // after trim to qualify as a duplicate candidate.
    const recent = [rec('e1', '電', 1200, 1)]
    expect(findPossibleDuplicate(cand('電', 1200), recent, NOW)).toBeNull()
  })

  it('rejects when outside the default time window', () => {
    const recent = [rec('e1', '電費', 1200, DEFAULT_WINDOW_MINUTES + 1)]
    expect(findPossibleDuplicate(cand('電費', 1200), recent, NOW)).toBeNull()
  })

  it('accepts at exactly the window boundary', () => {
    const recent = [rec('e1', '電費', 1200, DEFAULT_WINDOW_MINUTES)]
    expect(findPossibleDuplicate(cand('電費', 1200), recent, NOW)?.id).toBe('e1')
  })

  it('respects a custom window', () => {
    const recent = [rec('e1', '電費', 1200, 10)]
    expect(findPossibleDuplicate(cand('電費', 1200), recent, NOW, { windowMinutes: 15 })?.id).toBe('e1')
    expect(findPossibleDuplicate(cand('電費', 1200), recent, NOW, { windowMinutes: 5 })).toBeNull()
  })

  it('excludes the currently-edited expense (self-match)', () => {
    const recent = [rec('e1', '電費', 1200, 1), rec('e2', '電費', 1200, 2)]
    const hit = findPossibleDuplicate(cand('電費', 1200, 'e1'), recent, NOW)
    expect(hit?.id).toBe('e2') // e1 excluded, e2 still qualifies
  })

  it('returns the newest among multiple matches', () => {
    const recent = [
      rec('old', '電費', 1200, 4),
      rec('new', '電費', 1200, 1),
      rec('mid', '電費', 1200, 2),
    ]
    expect(findPossibleDuplicate(cand('電費', 1200), recent, NOW)?.id).toBe('new')
  })

  it('tolerates Firestore Timestamp-like createdAt', () => {
    const ts = { toDate: () => new Date(NOW - 2 * MIN) }
    const recent: RecentExpenseLike[] = [{ id: 'e1', description: '電費', amount: 1200, payerName: '爸爸', createdAt: ts }]
    expect(findPossibleDuplicate(cand('電費', 1200), recent, NOW)?.id).toBe('e1')
  })

  it('skips records with unparseable createdAt', () => {
    const recent: RecentExpenseLike[] = [
      // @ts-expect-error — intentional malformed
      { id: 'bad', description: '電費', amount: 1200, payerName: '爸爸', createdAt: 'oops' },
      rec('good', '電費', 1200, 1),
    ]
    expect(findPossibleDuplicate(cand('電費', 1200), recent, NOW)?.id).toBe('good')
  })

  it('rejects when amount is 0 (incomplete form, no real duplicate possible)', () => {
    const recent = [rec('e1', '電費', 0, 1)]
    expect(findPossibleDuplicate(cand('電費', 0), recent, NOW)).toBeNull()
  })

  it('empty candidate description short-circuits to null', () => {
    expect(findPossibleDuplicate(cand('', 1200), [rec('e1', '電費', 1200, 1)], NOW)).toBeNull()
  })
})

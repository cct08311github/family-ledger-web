import {
  findLastSettlementBetween,
  formatSettlementAge,
  DAY_MS,
  STALE_DAYS,
  type SettlementRecord,
} from '@/lib/settlement-history'

function s(
  fromId: string,
  toId: string,
  date: Date,
  amount = 100,
): SettlementRecord {
  return {
    fromMemberId: fromId,
    toMemberId: toId,
    date,
    amount,
  }
}

describe('findLastSettlementBetween', () => {
  it('returns null when list is empty', () => {
    expect(findLastSettlementBetween([], 'A', 'B')).toBeNull()
  })

  it('finds a single direct match (A→B)', () => {
    const d = new Date(2026, 3, 10)
    const out = findLastSettlementBetween([s('A', 'B', d)], 'A', 'B')
    expect(out?.date).toEqual(d)
    expect(out?.amount).toBe(100)
  })

  it('finds reverse direction (B→A also counts as "this pair settled")', () => {
    // The UI shows debt "A→B"; a prior "B→A" settlement still establishes
    // that they've transacted recently, so reverse direction is fair game.
    const d = new Date(2026, 3, 10)
    const out = findLastSettlementBetween([s('B', 'A', d)], 'A', 'B')
    expect(out?.date).toEqual(d)
  })

  it('returns the newest when multiple matches exist', () => {
    const older = new Date(2026, 3, 1)
    const newer = new Date(2026, 3, 15)
    const out = findLastSettlementBetween(
      [s('A', 'B', older, 10), s('B', 'A', newer, 20), s('A', 'B', new Date(2026, 2, 28), 5)],
      'A', 'B',
    )
    expect(out?.date).toEqual(newer)
    expect(out?.amount).toBe(20)
  })

  it('ignores settlements involving a different pair', () => {
    const d = new Date(2026, 3, 10)
    const out = findLastSettlementBetween(
      [s('A', 'C', d), s('C', 'B', d), s('D', 'E', d)],
      'A', 'B',
    )
    expect(out).toBeNull()
  })

  it('accepts Firestore Timestamp-like (has toDate())', () => {
    const real = new Date(2026, 3, 10)
    const ts = { toDate: () => real }
    const out = findLastSettlementBetween(
      // @ts-expect-error — simulate Firestore Timestamp duck type
      [s('A', 'B', ts)],
      'A', 'B',
    )
    expect(out?.date).toEqual(real)
  })

  it('skips records with unparseable dates', () => {
    // Defensive: corrupted doc shouldn't throw
    const good = new Date(2026, 3, 10)
    const out = findLastSettlementBetween(
      [
        // @ts-expect-error — intentional malformed
        s('A', 'B', 'not-a-date'),
        s('A', 'B', good),
      ],
      'A', 'B',
    )
    expect(out?.date).toEqual(good)
  })

  it('self-pair (A==B) returns null (not meaningful)', () => {
    expect(findLastSettlementBetween([s('A', 'A', new Date())], 'A', 'A')).toBeNull()
  })

  it('picks newest by DATE even when older record has larger amount', () => {
    // Regression guard: defends against a future refactor that accidentally
    // sorts by amount. The contract is "most recent settlement".
    const older = s('A', 'B', new Date(2026, 3, 1), 9999)
    const newer = s('A', 'B', new Date(2026, 3, 15), 50)
    const out = findLastSettlementBetween([older, newer], 'A', 'B')
    expect(out?.date).toEqual(new Date(2026, 3, 15))
    expect(out?.amount).toBe(50)
  })
})

describe('formatSettlementAge', () => {
  // Use an injectable `now` so tests don't depend on wall-clock time.
  const now = new Date(2026, 3, 18).getTime() // 2026-04-18 00:00 local

  it('returns fallback label when no settlement ever', () => {
    expect(formatSettlementAge(null, now)).toEqual({
      text: '尚未結算',
      daysAgo: null,
      isStale: false,
    })
  })

  it('0 days → 今天結算', () => {
    expect(formatSettlementAge(new Date(2026, 3, 18), now).text).toBe('今天結算')
  })

  it('1 day → 昨天', () => {
    expect(formatSettlementAge(new Date(2026, 3, 17), now).text).toBe('昨天結算')
  })

  it('N days (< 30) → N 天前', () => {
    expect(formatSettlementAge(new Date(2026, 3, 8), now).text).toBe('10 天前結算')
  })

  it('exact STALE_DAYS threshold → isStale=true (derived from const, not literal)', () => {
    // Test uses the exported STALE_DAYS so a future tuning (e.g. to 45 days)
    // doesn't make this test silently skew.
    const atThreshold = new Date(now - STALE_DAYS * DAY_MS)
    expect(formatSettlementAge(atThreshold, now).isStale).toBe(true)
    expect(formatSettlementAge(atThreshold, now).daysAgo).toBe(STALE_DAYS)
  })

  it('STALE_DAYS - 1 → isStale=false', () => {
    const justBefore = new Date(now - (STALE_DAYS - 1) * DAY_MS)
    expect(formatSettlementAge(justBefore, now).isStale).toBe(false)
  })

  it('future settlement defensively clamps to 今天', () => {
    // Clock skew or test fixture mismatch shouldn't render "-3 天前".
    expect(formatSettlementAge(new Date(2026, 3, 20), now).text).toBe('今天結算')
  })

  it('reports exact daysAgo regardless of stale flag', () => {
    expect(formatSettlementAge(new Date(2026, 2, 1), now).daysAgo).toBe(48)
  })
})

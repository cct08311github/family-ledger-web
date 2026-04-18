import { getActivityIcon, formatRelativeTime } from '@/lib/activity-format'

describe('getActivityIcon', () => {
  it('maps known expense actions', () => {
    expect(getActivityIcon('expense_created')).toBe('💸')
    expect(getActivityIcon('expense_updated')).toBe('✏️')
    expect(getActivityIcon('expense_deleted')).toBe('🗑️')
  })

  it('maps settlement actions', () => {
    expect(getActivityIcon('settlement_created')).toBe('✅')
    expect(getActivityIcon('settlement_deleted')).toBe('↩️')
  })

  it('maps member/category actions', () => {
    expect(getActivityIcon('member_added')).toBe('👤')
    expect(getActivityIcon('member_removed')).toBe('👤')
    expect(getActivityIcon('member_updated')).toBe('👤')
    expect(getActivityIcon('category_created')).toBe('📂')
    expect(getActivityIcon('category_updated')).toBe('✏️')
    expect(getActivityIcon('category_deleted')).toBe('🗑️')
  })

  it('falls back to pin for unknown actions', () => {
    expect(getActivityIcon('anything_else')).toBe('📌')
    expect(getActivityIcon('')).toBe('📌')
  })
})

describe('formatRelativeTime', () => {
  // 2026-04-18 10:00:00 local
  const now = new Date('2026-04-18T02:00:00Z').getTime()

  it('within the same minute returns 「剛剛」', () => {
    expect(formatRelativeTime(new Date(now - 30 * 1000), now)).toBe('剛剛')
    expect(formatRelativeTime(new Date(now - 59 * 1000), now)).toBe('剛剛')
  })

  it('1-59 minutes ago returns 「N 分鐘前」', () => {
    expect(formatRelativeTime(new Date(now - 60 * 1000), now)).toBe('1 分鐘前')
    expect(formatRelativeTime(new Date(now - 30 * 60 * 1000), now)).toBe('30 分鐘前')
    expect(formatRelativeTime(new Date(now - 59 * 60 * 1000), now)).toBe('59 分鐘前')
  })

  it('1-23 hours ago returns 「N 小時前」', () => {
    expect(formatRelativeTime(new Date(now - 60 * 60 * 1000), now)).toBe('1 小時前')
    expect(formatRelativeTime(new Date(now - 5 * 60 * 60 * 1000), now)).toBe('5 小時前')
    expect(formatRelativeTime(new Date(now - 23 * 60 * 60 * 1000), now)).toBe('23 小時前')
  })

  it('1-6 days ago returns 「N 天前」', () => {
    expect(formatRelativeTime(new Date(now - 24 * 60 * 60 * 1000), now)).toBe('1 天前')
    expect(formatRelativeTime(new Date(now - 6 * 24 * 60 * 60 * 1000), now)).toBe('6 天前')
  })

  it('7+ days ago falls back to month-day format', () => {
    const ten = new Date(now - 10 * 24 * 60 * 60 * 1000)
    const out = formatRelativeTime(ten, now)
    expect(out).toMatch(/\d+\/\d+/)
  })

  it('handles future timestamps defensively as 「剛剛」', () => {
    expect(formatRelativeTime(new Date(now + 5000), now)).toBe('剛剛')
  })

  it('accepts timestamp-like objects with toDate() (Firestore Timestamp)', () => {
    const fake = { toDate: () => new Date(now - 2 * 60 * 1000) }
    // @ts-expect-error — simulating Firestore Timestamp duck type
    expect(formatRelativeTime(fake, now)).toBe('2 分鐘前')
  })
})

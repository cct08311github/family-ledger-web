import { computeRecordingStreak } from '@/lib/recording-streak'
import type { Expense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15, 2026

function mk(id: string, daysAgo: number, hour = 10): Expense {
  const d = new Date(NOW - daysAgo * 86_400_000)
  d.setHours(hour, 0, 0, 0)
  return {
    id,
    groupId: 'g1',
    description: 'e',
    amount: 100,
    category: 'X',
    payerId: 'm1',
    payerName: '爸',
    isShared: true,
    splitMethod: 'equal',
    splits: [],
    paymentMethod: 'cash',
    date: d,
    createdAt: d,
    createdBy: 'u1',
    receiptPaths: [],
  } as unknown as Expense
}

describe('computeRecordingStreak', () => {
  it('returns null when no expenses', () => {
    expect(computeRecordingStreak({ expenses: [], now: NOW })).toBeNull()
  })

  it('returns null when only invalid createdAt entries', () => {
    const bad = { ...mk('a', 0), createdAt: 'oops' } as unknown as Expense
    expect(computeRecordingStreak({ expenses: [bad], now: NOW })).toBeNull()
  })

  it('counts current streak ending today inclusive', () => {
    const expenses = [mk('a', 0), mk('b', 1), mk('c', 2)]
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.currentStreak).toBe(3)
    expect(r!.recordedToday).toBe(true)
    expect(r!.longestStreak).toBe(3)
    expect(r!.isNewRecord).toBe(true)
  })

  it('counts current streak ending yesterday when today not yet recorded', () => {
    const expenses = [mk('a', 1), mk('b', 2), mk('c', 3)]
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.currentStreak).toBe(3)
    expect(r!.recordedToday).toBe(false)
  })

  it('current streak = 0 when last record is 2+ days ago', () => {
    const expenses = [mk('old', 3), mk('older', 4)]
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.currentStreak).toBe(0)
    expect(r!.recordedToday).toBe(false)
    expect(r!.longestStreak).toBe(2)
  })

  it('longestStreak finds best historical run', () => {
    // Streak 1: 2-3 days ago = 2 days. Streak 2: 6-9 days ago = 4 days.
    const expenses = [mk('a', 2), mk('b', 3), mk('c', 6), mk('d', 7), mk('e', 8), mk('f', 9)]
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.longestStreak).toBe(4)
    expect(r!.currentStreak).toBe(0)
  })

  it('multiple records on same day count as one streak day', () => {
    const expenses = [mk('a', 0, 9), mk('b', 0, 14), mk('c', 0, 21), mk('d', 1)]
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.currentStreak).toBe(2)
  })

  it('isNewRecord is true only when currentStreak === longestStreak', () => {
    const expenses = [mk('a', 0), mk('b', 1)] // current=2, longest=2
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.isNewRecord).toBe(true)

    const broken = [mk('a', 0), mk('b', 5), mk('c', 6), mk('d', 7)] // current=1, longest=3
    const r2 = computeRecordingStreak({ expenses: broken, now: NOW })
    expect(r2!.currentStreak).toBe(1)
    expect(r2!.longestStreak).toBe(3)
    expect(r2!.isNewRecord).toBe(false)
  })

  it('isNewRecord false when streak is 0', () => {
    const expenses = [mk('a', 5)]
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.currentStreak).toBe(0)
    expect(r!.isNewRecord).toBe(false)
  })

  it('daysRecordedThisMonth counts distinct dates in current month only', () => {
    // April 1..15 = current month
    const expenses = [
      mk('a', 0), // April 15
      mk('b', 5), // April 10
      mk('c', 14), // April 1
      mk('d', 16), // March 30 — outside month
      mk('e', 20), // March 26 — outside
    ]
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.daysRecordedThisMonth).toBe(3)
    expect(r!.daysInMonthSoFar).toBe(15)
  })

  it('lastRecordedDate is most recent record', () => {
    const expenses = [mk('a', 5), mk('b', 0), mk('c', 10)]
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.lastRecordedDate).toBe('2026-04-15')
  })

  it('handles long streak (30 days) without errors', () => {
    const expenses = Array.from({ length: 30 }, (_, i) => mk(String(i), i))
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.currentStreak).toBe(30)
    expect(r!.longestStreak).toBe(30)
  })

  it('isNewRecord false for streak that ties but is not current', () => {
    // Equal historical runs, current is shorter
    const expenses = [
      mk('a', 0), // current streak 1
      mk('b', 5),
      mk('c', 6),
      mk('d', 7), // historical 3
    ]
    const r = computeRecordingStreak({ expenses, now: NOW })
    expect(r!.currentStreak).toBe(1)
    expect(r!.longestStreak).toBe(3)
    expect(r!.isNewRecord).toBe(false)
  })

  it('uses createdAt not date — back-filled records do not count toward streak', () => {
    const today = new Date(NOW)
    today.setHours(10, 0, 0, 0)
    const longAgoDate = new Date(NOW - 100 * 86_400_000)
    longAgoDate.setHours(10, 0, 0, 0)
    // Record was created today but date field set to long ago (back-fill)
    const backFilled = {
      ...mk('back', 100),
      createdAt: today,
      date: longAgoDate,
    } as unknown as Expense
    const r = computeRecordingStreak({ expenses: [backFilled], now: NOW })
    expect(r!.currentStreak).toBe(1)
    expect(r!.recordedToday).toBe(true)
  })
})

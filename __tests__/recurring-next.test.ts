import {
  nextOccurrenceAfter,
  relativeDaysLabel,
  formatShortDate,
} from '@/lib/recurring-next'
import type { RecurringExpense } from '@/lib/types'

function mkTemplate(partial: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: 't1',
    groupId: 'g1',
    description: '租金',
    amount: 20000,
    category: '房租',
    payerId: 'm1',
    payerName: '爸',
    isShared: true,
    splitMethod: 'equal',
    splits: [],
    paymentMethod: 'transfer',
    frequency: 'monthly',
    dayOfMonth: 5,
    startDate: new Date(2026, 0, 5),
    endDate: null,
    lastGeneratedAt: null,
    isPaused: false,
    createdBy: 'u1',
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    ...partial,
  } as RecurringExpense
}

describe('nextOccurrenceAfter', () => {
  it('monthly: finds next month-day-5 after 2026-04-10', () => {
    const now = new Date(2026, 3, 10)
    const next = nextOccurrenceAfter(mkTemplate({ frequency: 'monthly', dayOfMonth: 5 }), now)
    expect(next?.getFullYear()).toBe(2026)
    expect(next?.getMonth()).toBe(4) // May
    expect(next?.getDate()).toBe(5)
  })

  it('monthly: finds this month day-15 when we ask on day-10', () => {
    const now = new Date(2026, 3, 10)
    const next = nextOccurrenceAfter(mkTemplate({ frequency: 'monthly', dayOfMonth: 15 }), now)
    expect(next?.getMonth()).toBe(3)
    expect(next?.getDate()).toBe(15)
  })

  it('weekly: finds next target day-of-week', () => {
    // 2026-04-18 is a Saturday (day 6). Ask on Friday 2026-04-17 for Sunday (0)
    const now = new Date(2026, 3, 17) // Friday
    const next = nextOccurrenceAfter(mkTemplate({ frequency: 'weekly', dayOfWeek: 0 }), now)
    expect(next?.getDay()).toBe(0)
    // Next Sunday from Friday 4/17 is 4/19
    expect(next?.getDate()).toBe(19)
  })

  it('yearly: finds next Jan 1 occurrence', () => {
    const now = new Date(2026, 3, 10)
    const next = nextOccurrenceAfter(
      mkTemplate({ frequency: 'yearly', monthOfYear: 1, dayOfMonth: 1 }),
      now,
    )
    expect(next?.getFullYear()).toBe(2027)
    expect(next?.getMonth()).toBe(0)
    expect(next?.getDate()).toBe(1)
  })

  it('returns null when endDate is past', () => {
    const now = new Date(2026, 5, 10)
    const next = nextOccurrenceAfter(
      mkTemplate({ frequency: 'monthly', dayOfMonth: 5, endDate: new Date(2026, 3, 5) }),
      now,
    )
    expect(next).toBeNull()
  })

  it('respects endDate when it falls within lookahead', () => {
    const now = new Date(2026, 3, 1)
    const endDate = new Date(2026, 3, 10) // 4/10
    const next = nextOccurrenceAfter(
      mkTemplate({ frequency: 'monthly', dayOfMonth: 5, endDate }),
      now,
    )
    expect(next?.getDate()).toBe(5) // 4/5 still reachable before end
  })
})

describe('relativeDaysLabel', () => {
  const NOW = new Date(2026, 3, 10) // April 10

  it.each([
    [new Date(2026, 3, 10), '今天'],
    [new Date(2026, 3, 11), '明天'],
    [new Date(2026, 3, 9), '昨天'],
    [new Date(2026, 3, 17), '7 天後'],
    [new Date(2026, 3, 3), '7 天前'],
    [new Date(2026, 4, 10), '30 天後'],
  ])('%s → %s', (target, expected) => {
    expect(relativeDaysLabel(target, NOW)).toBe(expected)
  })

  it('zero-times-out: intra-day times still count as 今天', () => {
    const now = new Date(2026, 3, 10, 8, 0)
    const target = new Date(2026, 3, 10, 22, 30)
    expect(relativeDaysLabel(target, now)).toBe('今天')
  })
})

describe('formatShortDate', () => {
  it('formats as YYYY/M/D (non-padded)', () => {
    expect(formatShortDate(new Date(2026, 0, 5))).toBe('2026/1/5')
    expect(formatShortDate(new Date(2026, 11, 25))).toBe('2026/12/25')
  })
})

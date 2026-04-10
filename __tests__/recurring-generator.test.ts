/**
 * Unit tests for recurring-generator.ts
 * Tests the pure function: getNextOccurrences(template, after, before)
 *
 * Range semantics: (after, before] — left exclusive, right inclusive.
 */

// Mock Firebase dependencies so the module can be imported without
// a real Firebase project or API key in the test environment.
jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}))

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  writeBatch: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
  },
}))

import { getNextOccurrences } from '@/lib/services/recurring-generator'
import type { RecurringExpense } from '@/lib/types'

// Helper to create a minimal RecurringExpense with sensible defaults
function mockTemplate(overrides: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: 'test',
    groupId: 'g1',
    description: 'Test',
    amount: 100,
    category: 'Test',
    payerId: 'p1',
    payerName: 'Test',
    isShared: true,
    splitMethod: 'equal',
    splits: [],
    paymentMethod: 'cash',
    frequency: 'monthly',
    isPaused: false,
    createdBy: 'u1',
    // Mock Timestamps
    startDate: { toDate: () => new Date('2025-01-01') } as any,
    createdAt: { toDate: () => new Date() } as any,
    updatedAt: { toDate: () => new Date() } as any,
    ...overrides,
  } as RecurringExpense
}

// ── Monthly ───────────────────────────────────────────────────────

describe('getNextOccurrences — monthly', () => {
  test('single month: dayOfMonth=15 in range returns one occurrence', () => {
    const template = mockTemplate({ frequency: 'monthly', dayOfMonth: 15 })
    const after = new Date('2025-03-01')
    const before = new Date('2025-03-31')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(new Date(2025, 2, 15)) // March 15
  })

  test('multiple months: range covers 3 months returns 3 occurrences', () => {
    const template = mockTemplate({ frequency: 'monthly', dayOfMonth: 10 })
    const after = new Date('2025-01-01')
    const before = new Date('2025-03-31')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual(new Date(2025, 0, 10)) // Jan 10
    expect(result[1]).toEqual(new Date(2025, 1, 10)) // Feb 10
    expect(result[2]).toEqual(new Date(2025, 2, 10)) // Mar 10
  })

  test('day clamping: dayOfMonth=31 in February clamps to 28 (non-leap year)', () => {
    const template = mockTemplate({ frequency: 'monthly', dayOfMonth: 31 })
    const after = new Date('2025-01-31')
    const before = new Date('2025-02-28')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(new Date(2025, 1, 28)) // Feb 28
  })

  test('day clamping: dayOfMonth=31 in April clamps to 30', () => {
    const template = mockTemplate({ frequency: 'monthly', dayOfMonth: 31 })
    const after = new Date('2025-03-31')
    const before = new Date('2025-04-30')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(new Date(2025, 3, 30)) // Apr 30
  })

  test('no occurrences when range is too narrow to include the target day', () => {
    // dayOfMonth=15, but range is Jan 16-31 — 15th is excluded
    const template = mockTemplate({ frequency: 'monthly', dayOfMonth: 15 })
    const after = new Date('2025-01-16')
    const before = new Date('2025-01-31')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(0)
  })

  test('boundary: after is exactly the target day — should NOT be included (exclusive left)', () => {
    const template = mockTemplate({ frequency: 'monthly', dayOfMonth: 15 })
    // after is midnight on Mar 15 — target falls exactly on after, so excluded
    const after = new Date(2025, 2, 15, 0, 0, 0, 0)
    const before = new Date('2025-04-30')

    const result = getNextOccurrences(template, after, before)

    // Mar 15 itself is excluded because candidate must be > after
    // Apr 15 is the first valid occurrence
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(new Date(2025, 3, 15)) // Apr 15
  })

  test('boundary: before is exactly the target day — should be included (inclusive right)', () => {
    const template = mockTemplate({ frequency: 'monthly', dayOfMonth: 15 })
    const after = new Date('2025-02-01')
    const before = new Date(2025, 2, 15, 0, 0, 0, 0) // exactly Mar 15 midnight

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(2) // Feb 15 and Mar 15
    expect(result[1]).toEqual(new Date(2025, 2, 15))
  })

  test('default dayOfMonth is 1 when not specified', () => {
    const template = mockTemplate({ frequency: 'monthly' }) // dayOfMonth omitted
    const after = new Date('2025-01-01')
    const before = new Date('2025-02-28')

    const result = getNextOccurrences(template, after, before)

    // Jan 1 is excluded (after is Jan 1), Feb 1 is included
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(new Date(2025, 1, 1)) // Feb 1
  })
})

// ── Weekly ────────────────────────────────────────────────────────

describe('getNextOccurrences — weekly', () => {
  test('single week: dayOfWeek=1 (Monday) in range returns one occurrence', () => {
    // 2025-03-03 is a Monday
    const template = mockTemplate({ frequency: 'weekly', dayOfWeek: 1 })
    const after = new Date('2025-03-01') // Saturday
    const before = new Date('2025-03-05') // Wednesday

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0].getDay()).toBe(1) // Monday
    expect(result[0]).toEqual(new Date(2025, 2, 3, 0, 0, 0, 0))
  })

  test('multiple weeks: range spanning 3 weeks returns 3 occurrences', () => {
    // Fridays: 2025-03-07, 2025-03-14, 2025-03-21
    const template = mockTemplate({ frequency: 'weekly', dayOfWeek: 5 })
    const after = new Date('2025-03-01')
    const before = new Date('2025-03-22')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(3)
    result.forEach((d) => expect(d.getDay()).toBe(5)) // all Fridays
  })

  test('dayOfWeek=0 (Sunday) is handled correctly', () => {
    // 2025-03-02 is a Sunday; 2025-03-08 is a Saturday (before next Sunday)
    const template = mockTemplate({ frequency: 'weekly', dayOfWeek: 0 })
    const after = new Date(2025, 2, 1, 0, 0, 0, 0)  // Sat Mar 1
    const before = new Date(2025, 2, 8, 0, 0, 0, 0) // Sat Mar 8 — excludes Mar 9 Sunday

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0].getDay()).toBe(0)
    expect(result[0]).toEqual(new Date(2025, 2, 2, 0, 0, 0, 0))
  })

  test('no occurrences when range is narrower than one week and misses target day', () => {
    // dayOfWeek=1 (Monday), but range is Tue-Fri — no Monday present
    // 2025-03-04 is Tuesday
    const template = mockTemplate({ frequency: 'weekly', dayOfWeek: 1 })
    const after = new Date('2025-03-04') // Tuesday
    const before = new Date('2025-03-07') // Friday

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(0)
  })

  test('default dayOfWeek is 1 (Monday) when not specified', () => {
    const template = mockTemplate({ frequency: 'weekly' }) // dayOfWeek omitted
    // 2025-03-03 is a Monday
    const after = new Date('2025-03-01')
    const before = new Date('2025-03-05')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0].getDay()).toBe(1)
  })
})

// ── Yearly ────────────────────────────────────────────────────────

describe('getNextOccurrences — yearly', () => {
  test('single year: occurrence in range returns one date', () => {
    // monthOfYear=6 (June), dayOfMonth=15 → June 15
    const template = mockTemplate({ frequency: 'yearly', monthOfYear: 6, dayOfMonth: 15 })
    const after = new Date('2025-01-01')
    const before = new Date('2025-12-31')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(new Date(2025, 5, 15)) // June 15 (0-indexed month)
  })

  test('range spanning two years returns two occurrences', () => {
    const template = mockTemplate({ frequency: 'yearly', monthOfYear: 1, dayOfMonth: 1 })
    const after = new Date('2024-06-01')
    const before = new Date('2026-06-01')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(new Date(2025, 0, 1)) // Jan 1 2025
    expect(result[1]).toEqual(new Date(2026, 0, 1)) // Jan 1 2026
  })

  test('yearly Feb 29 in non-leap year clamps to Feb 28', () => {
    // 2025 is not a leap year
    const template = mockTemplate({ frequency: 'yearly', monthOfYear: 2, dayOfMonth: 29 })
    const after = new Date('2025-01-01')
    const before = new Date('2025-12-31')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(new Date(2025, 1, 28)) // Feb 28 2025
  })

  test('yearly Feb 29 in leap year is NOT clamped', () => {
    // 2024 is a leap year
    const template = mockTemplate({ frequency: 'yearly', monthOfYear: 2, dayOfMonth: 29 })
    const after = new Date('2024-01-01')
    const before = new Date('2024-12-31')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(new Date(2024, 1, 29)) // Feb 29 2024
  })

  test('no occurrence when yearly date falls outside range', () => {
    // monthOfYear=12 (December), range ends before December
    const template = mockTemplate({ frequency: 'yearly', monthOfYear: 12, dayOfMonth: 25 })
    const after = new Date('2025-01-01')
    const before = new Date('2025-11-30')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(0)
  })

  test('default monthOfYear=1 and dayOfMonth=1 when not specified', () => {
    const template = mockTemplate({ frequency: 'yearly' })
    const after = new Date('2024-12-31')
    const before = new Date('2025-01-02')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(new Date(2025, 0, 1)) // Jan 1 2025
  })
})

// ── Edge cases ────────────────────────────────────────────────────

describe('getNextOccurrences — edge cases', () => {
  test('after === before → no occurrences regardless of frequency', () => {
    const sameDate = new Date('2025-06-15')

    const monthly = mockTemplate({ frequency: 'monthly', dayOfMonth: 15 })
    expect(getNextOccurrences(monthly, sameDate, sameDate)).toHaveLength(0)

    const weekly = mockTemplate({ frequency: 'weekly', dayOfWeek: sameDate.getDay() })
    expect(getNextOccurrences(weekly, sameDate, sameDate)).toHaveLength(0)

    const yearly = mockTemplate({ frequency: 'yearly', monthOfYear: 6, dayOfMonth: 15 })
    expect(getNextOccurrences(yearly, sameDate, sameDate)).toHaveLength(0)
  })

  test('returns empty array for unknown/unsupported frequency', () => {
    const template = mockTemplate({ frequency: 'daily' as any })
    const after = new Date('2025-01-01')
    const before = new Date('2025-12-31')

    const result = getNextOccurrences(template, after, before)

    expect(result).toEqual([])
  })

  test('monthly: occurrence on the last day of every month using dayOfMonth=31', () => {
    // Jan 31, Feb 28, Mar 31 across 3 months
    const template = mockTemplate({ frequency: 'monthly', dayOfMonth: 31 })
    const after = new Date('2025-01-01')
    const before = new Date('2025-03-31')

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual(new Date(2025, 0, 31)) // Jan 31
    expect(result[1]).toEqual(new Date(2025, 1, 28)) // Feb 28 (clamped)
    expect(result[2]).toEqual(new Date(2025, 2, 31)) // Mar 31
  })

  test('weekly: after is at midnight, next day is target — included', () => {
    // after = Sunday midnight, before = following Sunday midnight
    // dayOfWeek=1 (Monday) → Monday should appear
    // 2025-03-02 (Sun midnight) → 2025-03-03 (Mon) is in range
    const template = mockTemplate({ frequency: 'weekly', dayOfWeek: 1 })
    const after = new Date(2025, 2, 2, 0, 0, 0, 0) // Sun Mar 2 midnight
    const before = new Date(2025, 2, 9, 0, 0, 0, 0) // Sun Mar 9 midnight

    const result = getNextOccurrences(template, after, before)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(new Date(2025, 2, 3, 0, 0, 0, 0)) // Mon Mar 3
  })

  test('returns Date objects (not timestamps)', () => {
    const template = mockTemplate({ frequency: 'monthly', dayOfMonth: 1 })
    const after = new Date('2025-01-01')
    const before = new Date('2025-02-28')

    const result = getNextOccurrences(template, after, before)

    expect(result.length).toBeGreaterThan(0)
    result.forEach((d) => expect(d).toBeInstanceOf(Date))
  })
})

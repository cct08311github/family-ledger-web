import {
  monthRange,
  currentMonthRange,
  shiftMonth,
  parseYearMonth,
  isExactMonth,
  isCurrentMonth,
  formatMonthLabel,
} from '@/lib/month-nav'

describe('monthRange', () => {
  it('returns first and last day of a 30-day month', () => {
    expect(monthRange(2026, 4)).toEqual({
      year: 2026, month: 4, start: '2026-04-01', end: '2026-04-30',
    })
  })

  it('returns first and last day of a 31-day month', () => {
    expect(monthRange(2026, 1)).toEqual({
      year: 2026, month: 1, start: '2026-01-01', end: '2026-01-31',
    })
  })

  it('handles February 28 in non-leap year', () => {
    expect(monthRange(2025, 2)).toMatchObject({ start: '2025-02-01', end: '2025-02-28' })
  })

  it('handles February 29 in leap year', () => {
    expect(monthRange(2024, 2)).toMatchObject({ start: '2024-02-01', end: '2024-02-29' })
  })

  it('handles December (last month of year)', () => {
    expect(monthRange(2026, 12)).toMatchObject({ start: '2026-12-01', end: '2026-12-31' })
  })
})

describe('currentMonthRange', () => {
  it('uses today by default', () => {
    const r = currentMonthRange(new Date(2026, 3, 18)) // April 18, 2026
    expect(r).toMatchObject({ year: 2026, month: 4, start: '2026-04-01', end: '2026-04-30' })
  })
})

describe('shiftMonth', () => {
  it('shifts forward one month', () => {
    expect(shiftMonth(2026, 4, 1)).toMatchObject({ year: 2026, month: 5 })
  })

  it('shifts backward one month', () => {
    expect(shiftMonth(2026, 4, -1)).toMatchObject({ year: 2026, month: 3 })
  })

  it('wraps across year boundary going back from January', () => {
    expect(shiftMonth(2026, 1, -1)).toMatchObject({ year: 2025, month: 12 })
  })

  it('wraps across year boundary going forward from December', () => {
    expect(shiftMonth(2026, 12, 1)).toMatchObject({ year: 2027, month: 1 })
  })

  it('handles large delta (shift 14 months forward from Jan)', () => {
    expect(shiftMonth(2026, 1, 14)).toMatchObject({ year: 2027, month: 3 })
  })

  it('delta = 0 returns same month', () => {
    expect(shiftMonth(2026, 4, 0)).toMatchObject({ year: 2026, month: 4 })
  })
})

describe('parseYearMonth', () => {
  it('parses a valid ISO date', () => {
    expect(parseYearMonth('2026-04-01')).toEqual({ year: 2026, month: 4 })
  })

  it('returns null for empty string', () => {
    expect(parseYearMonth('')).toBeNull()
  })

  it('returns null for malformed input', () => {
    expect(parseYearMonth('04/01/2026')).toBeNull()
    expect(parseYearMonth('2026-4-1')).toBeNull()
    expect(parseYearMonth('garbage')).toBeNull()
  })

  it('returns null for out-of-range month', () => {
    expect(parseYearMonth('2026-13-01')).toBeNull()
    expect(parseYearMonth('2026-00-01')).toBeNull()
  })
})

describe('isExactMonth', () => {
  it('true when start/end exactly span a calendar month', () => {
    expect(isExactMonth('2026-04-01', '2026-04-30')).toBe(true)
  })

  it('false when start is not the 1st', () => {
    expect(isExactMonth('2026-04-02', '2026-04-30')).toBe(false)
  })

  it('false when end is not the last day', () => {
    expect(isExactMonth('2026-04-01', '2026-04-29')).toBe(false)
  })

  it('false when range spans multiple months', () => {
    expect(isExactMonth('2026-03-01', '2026-04-30')).toBe(false)
  })

  it('false for invalid start', () => {
    expect(isExactMonth('garbage', '2026-04-30')).toBe(false)
  })
})

describe('isCurrentMonth', () => {
  it('true when range equals today-month', () => {
    expect(isCurrentMonth('2026-04-01', '2026-04-30', new Date(2026, 3, 18))).toBe(true)
  })

  it('false for prior month', () => {
    expect(isCurrentMonth('2026-03-01', '2026-03-31', new Date(2026, 3, 18))).toBe(false)
  })

  it('false for custom range in current month', () => {
    expect(isCurrentMonth('2026-04-05', '2026-04-20', new Date(2026, 3, 18))).toBe(false)
  })
})

describe('formatMonthLabel', () => {
  it('zero-pads single-digit months', () => {
    expect(formatMonthLabel({ year: 2026, month: 4 })).toBe('2026/04')
  })

  it('does not pad two-digit months', () => {
    expect(formatMonthLabel({ year: 2026, month: 12 })).toBe('2026/12')
  })
})

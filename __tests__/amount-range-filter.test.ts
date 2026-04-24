import {
  matchesAmountRange,
  parseAmountRangeParam,
  AMOUNT_RANGE_KEYS,
  AMOUNT_RANGE_LABELS,
} from '@/lib/amount-range-filter'

describe('matchesAmountRange', () => {
  it('all matches everything including edges', () => {
    expect(matchesAmountRange(0, 'all')).toBe(true)
    expect(matchesAmountRange(999999, 'all')).toBe(true)
  })

  it.each([
    [0, true],
    [50, true],
    [99.99, true],
    [100, false],
    [500, false],
  ])('under100: %s → %s', (amt, expected) => {
    expect(matchesAmountRange(amt, 'under100')).toBe(expected)
  })

  it.each([
    [99, false],
    [100, true],
    [250, true],
    [499.99, true],
    [500, false],
  ])('100-500: %s → %s', (amt, expected) => {
    expect(matchesAmountRange(amt, '100-500')).toBe(expected)
  })

  it.each([
    [499, false],
    [500, true],
    [1000, true],
    [1999.99, true],
    [2000, false],
  ])('500-2000: %s → %s', (amt, expected) => {
    expect(matchesAmountRange(amt, '500-2000')).toBe(expected)
  })

  it.each([
    [1999, false],
    [2000, true],
    [10000, true],
  ])('over2000: %s → %s', (amt, expected) => {
    expect(matchesAmountRange(amt, 'over2000')).toBe(expected)
  })
})

describe('parseAmountRangeParam', () => {
  it.each([
    [null, 'all'],
    [undefined, 'all'],
    ['', 'all'],
    ['garbage', 'all'],
    ['42', 'all'],
    ['all', 'all'],
    ['under100', 'under100'],
    ['100-500', '100-500'],
    ['500-2000', '500-2000'],
    ['over2000', 'over2000'],
  ])('%s → %s', (input, expected) => {
    expect(parseAmountRangeParam(input)).toBe(expected)
  })
})

describe('shape invariants', () => {
  it('every key has a label', () => {
    for (const k of AMOUNT_RANGE_KEYS) {
      expect(AMOUNT_RANGE_LABELS[k]).toBeTruthy()
    }
  })
})

/**
 * Amount-range filter for the records page (Issue #221).
 *
 * Defines the canonical set of quick ranges users can pick to narrow
 * records by transaction amount, plus parse/predicate helpers. Kept as
 * pure functions so the page logic stays testable.
 */
export type AmountRangeKey =
  | 'all'
  | 'under100'
  | '100-500'
  | '500-2000'
  | 'over2000'

export const AMOUNT_RANGE_KEYS: readonly AmountRangeKey[] = [
  'all',
  'under100',
  '100-500',
  '500-2000',
  'over2000',
]

export const AMOUNT_RANGE_LABELS: Record<AmountRangeKey, string> = {
  all: '全部',
  under100: '<100',
  '100-500': '100–500',
  '500-2000': '500–2000',
  over2000: '>2000',
}

export function matchesAmountRange(amount: number, key: AmountRangeKey): boolean {
  switch (key) {
    case 'all':
      return true
    case 'under100':
      return amount < 100
    case '100-500':
      return amount >= 100 && amount < 500
    case '500-2000':
      return amount >= 500 && amount < 2000
    case 'over2000':
      return amount >= 2000
  }
}

/**
 * Parse a `?amount=` query param value into a valid range key.
 * Returns 'all' for missing / unknown / empty values so callers always
 * get a usable value without narrowing.
 */
export function parseAmountRangeParam(
  param: string | null | undefined,
): AmountRangeKey {
  if (!param) return 'all'
  switch (param) {
    case 'under100':
    case '100-500':
    case '500-2000':
    case 'over2000':
      return param
    default:
      return 'all'
  }
}

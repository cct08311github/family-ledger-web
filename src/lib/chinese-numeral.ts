const DIGITS = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']
const SECTION_UNITS = ['', '萬', '億', '兆']
const PLACE_UNITS = ['', '拾', '佰', '仟']

function convertSection(n: number): string {
  // n is 0..9999
  if (n === 0) return ''
  let result = ''
  let zeroPending = false
  let started = false

  for (let placeIdx = 3; placeIdx >= 0; placeIdx--) {
    const divisor = Math.pow(10, placeIdx)
    const digit = Math.floor(n / divisor) % 10

    if (digit === 0) {
      if (started) zeroPending = true
    } else {
      if (zeroPending) {
        result += DIGITS[0]
        zeroPending = false
      }
      result += DIGITS[digit] + PLACE_UNITS[placeIdx]
      started = true
    }
  }

  return result
}

/**
 * Convert a non-negative integer/decimal amount to traditional Chinese
 * formal numerals (used on red envelopes, checks, formal receipts).
 *
 * Examples:
 *   1234 → 壹仟貳佰參拾肆元
 *   10000 → 壹萬元
 *   1234.56 → 壹仟貳佰參拾肆元伍角陸分
 *
 * Returns empty string for invalid / zero / negative input — caller
 * decides whether to render.
 */
export function toChineseNumeral(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return ''

  const integerPart = Math.floor(amount)
  const decimalPart = Math.round((amount - integerPart) * 100)

  let result = ''

  if (integerPart === 0) {
    result = DIGITS[0]
  } else {
    // Split into 4-digit sections from the right: 億 萬 (units)
    const sections: number[] = []
    let remaining = integerPart
    while (remaining > 0) {
      sections.push(remaining % 10000)
      remaining = Math.floor(remaining / 10000)
    }

    if (sections.length > SECTION_UNITS.length) {
      // Beyond 兆 — rare for personal ledger; just bail
      return ''
    }

    let prevSectionWasZero = false
    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i]
      if (section === 0) {
        prevSectionWasZero = true
        continue
      }
      // If previous section ended without filling all 4 digits, prepend 零
      if (result && (prevSectionWasZero || section < 1000)) {
        result += DIGITS[0]
      }
      result += convertSection(section) + SECTION_UNITS[i]
      prevSectionWasZero = false
    }
  }

  result += '元'

  if (decimalPart > 0) {
    const jiao = Math.floor(decimalPart / 10)
    const fen = decimalPart % 10
    if (jiao > 0) result += DIGITS[jiao] + '角'
    if (fen > 0) result += DIGITS[fen] + '分'
  }

  return result
}

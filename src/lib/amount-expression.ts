/**
 * Safe amount-expression evaluator for expense inputs (Issue #220).
 *
 * Allows the user to type `700+150` etc. in the amount field and have it
 * computed to a final number via a hand-rolled recursive-descent parser.
 * No dynamic code execution. No global math libraries. Only digits,
 * decimal point, + - * / ( ), and the full-width multiply/divide signs
 * × ÷ (Chinese/Japanese keyboards). Whitespace is ignored.
 *
 * Guarantees:
 * - Non-finite results (e.g. /0) return an error, not Infinity/NaN.
 * - Negative results return an error (amounts can't be negative).
 * - Result is rounded to 2 decimals (currency).
 */
export type AmountExpressionResult =
  | { ok: true; value: number }
  | { ok: false; error: AmountExpressionError }

export type AmountExpressionError =
  | 'empty'
  | 'invalid_char'
  | 'syntax'
  | 'division_by_zero'
  | 'non_finite'
  | 'negative'

const ALLOWED_CHARS = /^[0-9+\-*/.()\s×÷]+$/

export function evaluateAmountExpression(input: string): AmountExpressionResult {
  // Normalize full-width operators. Users on Chinese keyboards often type
  // 50×2 instead of 50*2; treating them as ASCII is safer than rejecting.
  const normalized = input.replace(/×/g, '*').replace(/÷/g, '/')
  const source = normalized.trim()
  if (!source) return { ok: false, error: 'empty' }
  if (!ALLOWED_CHARS.test(source)) return { ok: false, error: 'invalid_char' }

  let pos = 0
  let divisionByZero = false

  function skipWs(): void {
    while (pos < source.length && source[pos] === ' ') pos++
  }
  function peek(): string | undefined {
    skipWs()
    return source[pos]
  }
  function consume(): string | undefined {
    skipWs()
    return source[pos++]
  }

  function parseFactor(): number | null {
    if (peek() === '(') {
      consume()
      const v = parseExpr()
      if (v === null || peek() !== ')') return null
      consume()
      return v
    }
    const start = pos
    while (pos < source.length && /[0-9.]/.test(source[pos])) pos++
    if (pos === start) return null
    const num = Number.parseFloat(source.slice(start, pos))
    if (!Number.isFinite(num)) return null
    return num
  }

  function parseTerm(): number | null {
    let left = parseFactor()
    if (left === null) return null
    while (peek() === '*' || peek() === '/') {
      const op = consume()
      const right = parseFactor()
      if (right === null) return null
      if (op === '/' && right === 0) {
        divisionByZero = true
        return null
      }
      left = op === '*' ? left * right : left / right
    }
    return left
  }

  function parseExpr(): number | null {
    let left = parseTerm()
    if (left === null) return null
    while (peek() === '+' || peek() === '-') {
      const op = consume()
      const right = parseTerm()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  const value = parseExpr()
  skipWs()

  if (divisionByZero) return { ok: false, error: 'division_by_zero' }
  if (value === null) return { ok: false, error: 'syntax' }
  if (pos !== source.length) return { ok: false, error: 'syntax' }
  if (!Number.isFinite(value)) return { ok: false, error: 'non_finite' }
  if (value < 0) return { ok: false, error: 'negative' }

  const rounded = Math.round(value * 100) / 100
  return { ok: true, value: rounded }
}

/**
 * Apply a quick-chip operator to the current amount string.
 * Concatenates the current value with the chip and re-evaluates.
 * On error, returns current unchanged — caller can surface a toast.
 *
 * Chips: '+50' | '+100' | '-50' | '*2' | '/2' | 'clear'
 */
export type AmountChip = '+50' | '+100' | '-50' | '*2' | '/2' | 'clear'

export function applyAmountChip(current: string, chip: AmountChip): string {
  if (chip === 'clear') return ''
  const base = current.trim() || '0'
  const result = evaluateAmountExpression(base + chip)
  if (!result.ok) return current
  return String(result.value)
}

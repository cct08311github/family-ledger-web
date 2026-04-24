import {
  evaluateAmountExpression,
  applyAmountChip,
} from '@/lib/amount-expression'

describe('evaluateAmountExpression', () => {
  describe('valid inputs', () => {
    it.each([
      ['700', 700],
      ['1.5', 1.5],
      ['700+150', 850],
      ['1000-100', 900],
      ['100*3', 300],
      ['1200/2', 600],
      ['100+50*2', 200], // precedence
      ['(100+50)*2', 300],
      ['1.5+2.5', 4],
      ['  700  +  150  ', 850],
      ['50×2', 100], // full-width multiply
      ['100÷2', 50], // full-width divide
      ['((1+2)*3)+4', 13], // nested parens
      ['0.1+0.2', 0.3], // rounding to 2 decimals (0.30000…4 → 0.3)
    ])('%s → %s', (expr, expected) => {
      const r = evaluateAmountExpression(expr)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.value).toBe(expected)
    })
  })

  describe('errors', () => {
    it.each([
      ['', 'empty'],
      ['   ', 'empty'],
      ['abc', 'invalid_char'],
      ['100abc', 'invalid_char'],
      ['<script>', 'invalid_char'],
      ['100/0', 'division_by_zero'],
      ['100-200', 'negative'],
      ['700+', 'syntax'],
      ['+700', 'syntax'], // leading operator
      ['100 200', 'syntax'], // missing operator
      ['(100+50', 'syntax'], // unmatched paren
      ['100+50)', 'syntax'], // stray close paren
      ['*5', 'syntax'],
      ['5**2', 'syntax'],
    ])('%s → error %s', (expr, errorCode) => {
      const r = evaluateAmountExpression(expr)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toBe(errorCode)
    })
  })

  it('rounds to 2 decimals', () => {
    const r = evaluateAmountExpression('100/3')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(33.33)
  })

  it('treats a plain number as identity', () => {
    const r = evaluateAmountExpression('42')
    expect(r).toEqual({ ok: true, value: 42 })
  })
})

describe('applyAmountChip', () => {
  it('clears to empty string', () => {
    expect(applyAmountChip('700', 'clear')).toBe('')
  })

  it('adds +50 to an existing amount', () => {
    expect(applyAmountChip('700', '+50')).toBe('750')
  })

  it('adds +100 to an existing amount', () => {
    expect(applyAmountChip('700', '+100')).toBe('800')
  })

  it('subtracts -50, never below zero (returns current)', () => {
    expect(applyAmountChip('20', '-50')).toBe('20') // would go negative, no-op
  })

  it('multiplies by 2', () => {
    expect(applyAmountChip('150', '*2')).toBe('300')
  })

  it('divides by 2', () => {
    expect(applyAmountChip('150', '/2')).toBe('75')
  })

  it('treats empty as 0 for +/-', () => {
    expect(applyAmountChip('', '+50')).toBe('50')
    expect(applyAmountChip('', '+100')).toBe('100')
  })

  it('returns current unchanged when current is invalid expression', () => {
    expect(applyAmountChip('abc', '+50')).toBe('abc')
  })

  it('chains chips by re-evaluating the running number', () => {
    const after1 = applyAmountChip('100', '+50') // 150
    const after2 = applyAmountChip(after1, '*2') // 300
    const after3 = applyAmountChip(after2, '-50') // 250
    expect([after1, after2, after3]).toEqual(['150', '300', '250'])
  })
})

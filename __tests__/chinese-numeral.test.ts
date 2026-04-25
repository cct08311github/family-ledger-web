import { toChineseNumeral } from '@/lib/chinese-numeral'

describe('toChineseNumeral', () => {
  it('returns empty string for invalid input', () => {
    expect(toChineseNumeral(NaN)).toBe('')
    expect(toChineseNumeral(Infinity)).toBe('')
    expect(toChineseNumeral(-100)).toBe('')
    expect(toChineseNumeral(0)).toBe('')
  })

  it('handles single digits', () => {
    expect(toChineseNumeral(1)).toBe('壹元')
    expect(toChineseNumeral(5)).toBe('伍元')
    expect(toChineseNumeral(9)).toBe('玖元')
  })

  it('handles tens', () => {
    expect(toChineseNumeral(10)).toBe('壹拾元')
    expect(toChineseNumeral(25)).toBe('貳拾伍元')
    expect(toChineseNumeral(99)).toBe('玖拾玖元')
  })

  it('handles hundreds', () => {
    expect(toChineseNumeral(100)).toBe('壹佰元')
    expect(toChineseNumeral(123)).toBe('壹佰貳拾參元')
    expect(toChineseNumeral(105)).toBe('壹佰零伍元')
  })

  it('handles thousands', () => {
    expect(toChineseNumeral(1000)).toBe('壹仟元')
    expect(toChineseNumeral(1234)).toBe('壹仟貳佰參拾肆元')
    expect(toChineseNumeral(1005)).toBe('壹仟零伍元')
  })

  it('handles ten-thousands (萬)', () => {
    expect(toChineseNumeral(10000)).toBe('壹萬元')
    expect(toChineseNumeral(12345)).toBe('壹萬貳仟參佰肆拾伍元')
    expect(toChineseNumeral(10001)).toBe('壹萬零壹元')
  })

  it('handles hundred-thousands', () => {
    expect(toChineseNumeral(100000)).toBe('壹拾萬元')
    expect(toChineseNumeral(123456)).toBe('壹拾貳萬參仟肆佰伍拾陸元')
  })

  it('handles million-range (億)', () => {
    expect(toChineseNumeral(100000000)).toBe('壹億元')
    expect(toChineseNumeral(123456789)).toBe('壹億貳仟參佰肆拾伍萬陸仟柒佰捌拾玖元')
  })

  it('handles decimals (角分)', () => {
    expect(toChineseNumeral(0.5)).toBe('零元伍角')
    expect(toChineseNumeral(0.05)).toBe('零元伍分')
    expect(toChineseNumeral(0.55)).toBe('零元伍角伍分')
    expect(toChineseNumeral(1.5)).toBe('壹元伍角')
    expect(toChineseNumeral(1234.56)).toBe('壹仟貳佰參拾肆元伍角陸分')
  })

  it('rounds decimal to 2 places', () => {
    expect(toChineseNumeral(1.234)).toBe('壹元貳角參分')
    expect(toChineseNumeral(1.235)).toBe('壹元貳角肆分') // round half to even / up
  })

  it('handles values beyond 兆 by returning empty (out-of-range)', () => {
    // 1 兆兆 = 10^16 way beyond 4 sections
    const huge = 1e20
    expect(toChineseNumeral(huge)).toBe('')
  })

  it('handles 萬 boundary correctly', () => {
    // 100000000 = 1億, NOT 10000萬
    expect(toChineseNumeral(100000000)).toBe('壹億元')
    expect(toChineseNumeral(99999999)).toBe('玖仟玖佰玖拾玖萬玖仟玖佰玖拾玖元')
  })
})

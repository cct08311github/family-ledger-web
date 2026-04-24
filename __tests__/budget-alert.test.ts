import {
  shouldTriggerAlert,
  buildAlertHistoryKey,
  buildAlertMessage,
} from '@/lib/budget-alert'

describe('buildAlertHistoryKey', () => {
  it('zero-pads month', () => {
    expect(buildAlertHistoryKey(2026, 3, 80)).toBe('2026-03-80')
    expect(buildAlertHistoryKey(2026, 12, 100)).toBe('2026-12-100')
  })
})

describe('shouldTriggerAlert', () => {
  const YEAR = 2026
  const MONTH = 4

  describe('skip conditions', () => {
    it('returns null when budget is 0', () => {
      expect(
        shouldTriggerAlert({ currentTotal: 100, budget: 0, history: {}, year: YEAR, month: MONTH }),
      ).toBeNull()
    })

    it('returns null when budget is negative', () => {
      expect(
        shouldTriggerAlert({ currentTotal: 100, budget: -10, history: {}, year: YEAR, month: MONTH }),
      ).toBeNull()
    })

    it('returns null when budget is NaN', () => {
      expect(
        shouldTriggerAlert({ currentTotal: 100, budget: NaN, history: {}, year: YEAR, month: MONTH }),
      ).toBeNull()
    })

    it('returns null when currentTotal is negative (defensive)', () => {
      expect(
        shouldTriggerAlert({ currentTotal: -10, budget: 100, history: {}, year: YEAR, month: MONTH }),
      ).toBeNull()
    })

    it('returns null when under 80% and no history', () => {
      expect(
        shouldTriggerAlert({ currentTotal: 79, budget: 100, history: {}, year: YEAR, month: MONTH }),
      ).toBeNull()
    })
  })

  describe('80% threshold', () => {
    it('fires at exactly 80%', () => {
      const result = shouldTriggerAlert({ currentTotal: 80, budget: 100, history: {}, year: YEAR, month: MONTH })
      expect(result).toEqual({
        threshold: 80,
        historyKey: '2026-04-80',
        alsoMark: [],
      })
    })

    it('fires at 85% when no history', () => {
      const result = shouldTriggerAlert({ currentTotal: 85, budget: 100, history: {}, year: YEAR, month: MONTH })
      expect(result?.threshold).toBe(80)
    })

    it('does NOT re-fire 80% when already in history', () => {
      const result = shouldTriggerAlert({
        currentTotal: 85,
        budget: 100,
        history: { '2026-04-80': true },
        year: YEAR,
        month: MONTH,
      })
      expect(result).toBeNull()
    })

    it('history for OTHER month does not prevent firing', () => {
      const result = shouldTriggerAlert({
        currentTotal: 80,
        budget: 100,
        history: { '2026-03-80': true }, // previous month
        year: YEAR,
        month: MONTH,
      })
      expect(result?.threshold).toBe(80)
    })
  })

  describe('100% threshold', () => {
    it('fires at exactly 100%', () => {
      const result = shouldTriggerAlert({ currentTotal: 100, budget: 100, history: {}, year: YEAR, month: MONTH })
      expect(result).toEqual({
        threshold: 100,
        historyKey: '2026-04-100',
        alsoMark: ['2026-04-80'],
      })
    })

    it('fires at 150% when no 100% history', () => {
      const result = shouldTriggerAlert({
        currentTotal: 150,
        budget: 100,
        history: { '2026-04-80': true },
        year: YEAR,
        month: MONTH,
      })
      expect(result?.threshold).toBe(100)
    })

    it('does NOT re-fire 100% when already in history', () => {
      const result = shouldTriggerAlert({
        currentTotal: 120,
        budget: 100,
        history: { '2026-04-100': true, '2026-04-80': true },
        year: YEAR,
        month: MONTH,
      })
      expect(result).toBeNull()
    })

    it('100% jumps over 80% and marks both', () => {
      const result = shouldTriggerAlert({
        currentTotal: 110,
        budget: 100,
        history: {},
        year: YEAR,
        month: MONTH,
      })
      expect(result?.threshold).toBe(100)
      expect(result?.alsoMark).toContain('2026-04-80')
    })
  })

  describe('precedence', () => {
    it('100% wins over 80% in same tick', () => {
      const result = shouldTriggerAlert({
        currentTotal: 100,
        budget: 100,
        history: {},
        year: YEAR,
        month: MONTH,
      })
      expect(result?.threshold).toBe(100)
    })

    it('at 99.9% fires 80% (not 100%)', () => {
      const result = shouldTriggerAlert({
        currentTotal: 99.9,
        budget: 100,
        history: {},
        year: YEAR,
        month: MONTH,
      })
      expect(result?.threshold).toBe(80)
    })

    it('at 79.9% fires nothing', () => {
      const result = shouldTriggerAlert({
        currentTotal: 79.9,
        budget: 100,
        history: {},
        year: YEAR,
        month: MONTH,
      })
      expect(result).toBeNull()
    })
  })

  it('accepts undefined history as empty', () => {
    const result = shouldTriggerAlert({
      currentTotal: 80,
      budget: 100,
      history: undefined,
      year: YEAR,
      month: MONTH,
    })
    expect(result?.threshold).toBe(80)
  })
})

describe('buildAlertMessage', () => {
  it('formats 100% body with overspend wording', () => {
    const msg = buildAlertMessage(
      { threshold: 100, historyKey: '2026-04-100', alsoMark: [] },
      { currentTotal: 12000, budget: 10000 },
    )
    expect(msg.title).toContain('超過預算')
    expect(msg.body).toContain('12,000')
    expect(msg.body).toContain('10,000')
  })

  it('formats 80% body with remaining amount', () => {
    const msg = buildAlertMessage(
      { threshold: 80, historyKey: '2026-04-80', alsoMark: [] },
      { currentTotal: 8000, budget: 10000 },
    )
    expect(msg.title).toContain('80%')
    expect(msg.body).toContain('8,000')
    expect(msg.body).toContain('10,000')
    expect(msg.body).toContain('2,000') // remaining
  })
})

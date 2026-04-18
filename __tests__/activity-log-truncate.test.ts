import {
  MAX_ACTIVITY_LOG_DESCRIPTION_LENGTH,
  truncateActivityDescription,
} from '@/lib/activity-description-limit'

describe('truncateActivityDescription', () => {
  it('passes through short strings unchanged', () => {
    expect(truncateActivityDescription('新增支出：午餐')).toBe('新增支出：午餐')
  })

  it('passes through strings exactly at the limit unchanged', () => {
    const s = 'x'.repeat(MAX_ACTIVITY_LOG_DESCRIPTION_LENGTH)
    expect(truncateActivityDescription(s)).toBe(s)
  })

  it('truncates and appends ellipsis when over the limit', () => {
    const s = 'x'.repeat(MAX_ACTIVITY_LOG_DESCRIPTION_LENGTH + 50)
    const out = truncateActivityDescription(s)
    expect(out.length).toBe(MAX_ACTIVITY_LOG_DESCRIPTION_LENGTH)
    expect(out.endsWith('…')).toBe(true)
  })

  it('does not exceed the limit for any input', () => {
    const s = 'x'.repeat(10_000)
    expect(truncateActivityDescription(s).length).toBeLessThanOrEqual(
      MAX_ACTIVITY_LOG_DESCRIPTION_LENGTH,
    )
  })

  it('handles empty string', () => {
    expect(truncateActivityDescription('')).toBe('')
  })
})

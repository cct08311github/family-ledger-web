import {
  getRangePreset,
  matchActivePreset,
  presetLabel,
  PRESET_KEYS,
} from '@/lib/date-range-presets'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15, 2026 = Wed

describe('getRangePreset', () => {
  it('today returns single-day range', () => {
    expect(getRangePreset('today', NOW)).toEqual({
      start: '2026-04-15',
      end: '2026-04-15',
    })
  })

  it('this-week returns Mon-Sun for current week', () => {
    // April 15 = Wed → Mon = April 13, Sun = April 19
    expect(getRangePreset('this-week', NOW)).toEqual({
      start: '2026-04-13',
      end: '2026-04-19',
    })
  })

  it('this-month returns 1st..last-day of current month', () => {
    expect(getRangePreset('this-month', NOW)).toEqual({
      start: '2026-04-01',
      end: '2026-04-30',
    })
  })

  it('last-month returns entire previous calendar month', () => {
    expect(getRangePreset('last-month', NOW)).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    })
  })

  it('last-7 returns 7-day inclusive range', () => {
    expect(getRangePreset('last-7', NOW)).toEqual({
      start: '2026-04-09',
      end: '2026-04-15',
    })
  })

  it('last-30 returns 30-day inclusive range', () => {
    expect(getRangePreset('last-30', NOW)).toEqual({
      start: '2026-03-17',
      end: '2026-04-15',
    })
  })

  it('this-week handles Sunday as end of week', () => {
    // April 19, 2026 = Sunday
    const sunday = new Date(2026, 3, 19, 12, 0, 0).getTime()
    expect(getRangePreset('this-week', sunday)).toEqual({
      start: '2026-04-13', // Monday
      end: '2026-04-19', // Sunday
    })
  })

  it('this-week handles Monday as start of week', () => {
    const monday = new Date(2026, 3, 13, 12, 0, 0).getTime()
    expect(getRangePreset('this-week', monday)).toEqual({
      start: '2026-04-13',
      end: '2026-04-19',
    })
  })

  it('last-month crosses year (Jan → previous Dec)', () => {
    const jan15_2027 = new Date(2027, 0, 15, 12, 0, 0).getTime()
    expect(getRangePreset('last-month', jan15_2027)).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
    })
  })

  it('this-month handles February (28-day)', () => {
    const feb15 = new Date(2026, 1, 15, 12, 0, 0).getTime()
    expect(getRangePreset('this-month', feb15)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
  })

  it('this-month handles February in leap year', () => {
    const feb15_2024 = new Date(2024, 1, 15, 12, 0, 0).getTime()
    expect(getRangePreset('this-month', feb15_2024)).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    })
  })
})

describe('matchActivePreset', () => {
  it('returns matching preset key when range matches', () => {
    expect(matchActivePreset('2026-04-15', '2026-04-15', NOW)).toBe('today')
    expect(matchActivePreset('2026-04-13', '2026-04-19', NOW)).toBe('this-week')
    expect(matchActivePreset('2026-04-01', '2026-04-30', NOW)).toBe('this-month')
    expect(matchActivePreset('2026-03-01', '2026-03-31', NOW)).toBe('last-month')
  })

  it('returns null when range does not match any preset', () => {
    expect(matchActivePreset('2026-04-10', '2026-04-12', NOW)).toBeNull()
    expect(matchActivePreset('', '', NOW)).toBeNull()
  })
})

describe('PRESET_KEYS and presetLabel', () => {
  it('PRESET_KEYS contains all 6 keys', () => {
    expect(PRESET_KEYS.length).toBe(6)
  })

  it('presetLabel returns Chinese label for each key', () => {
    expect(presetLabel('today')).toBe('今天')
    expect(presetLabel('this-week')).toBe('本週')
    expect(presetLabel('this-month')).toBe('本月')
    expect(presetLabel('last-month')).toBe('上月')
    expect(presetLabel('last-7')).toBe('近 7 天')
    expect(presetLabel('last-30')).toBe('近 30 天')
  })
})

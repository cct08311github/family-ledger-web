export type DateRangePresetKey =
  | 'today'
  | 'this-week'
  | 'this-month'
  | 'last-month'
  | 'last-7'
  | 'last-30'

export interface DateRange {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}

const LABELS: Record<DateRangePresetKey, string> = {
  today: '今天',
  'this-week': '本週',
  'this-month': '本月',
  'last-month': '上月',
  'last-7': '近 7 天',
  'last-30': '近 30 天',
}

export function presetLabel(key: DateRangePresetKey): string {
  return LABELS[key]
}

export const PRESET_KEYS: DateRangePresetKey[] = [
  'today',
  'this-week',
  'this-month',
  'last-month',
  'last-7',
  'last-30',
]

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Compute Mon-Sun week start for the given date (Sunday belongs to the
 * previous week so it's the LAST day of week).
 */
function mondayOf(d: Date): Date {
  const x = startOfDay(d)
  const dow = x.getDay()
  const offset = dow === 0 ? 6 : dow - 1
  x.setDate(x.getDate() - offset)
  return x
}

/**
 * Returns a YYYY-MM-DD inclusive range for a given preset key. Range
 * semantics:
 *   - `today` = single-day range
 *   - `this-week` = Mon..Sun of current week
 *   - `this-month` = 1st..last-day of current month
 *   - `last-month` = entire previous calendar month (cross-year safe)
 *   - `last-7` = (today-6)..today (7 days inclusive)
 *   - `last-30` = (today-29)..today
 */
export function getRangePreset(
  key: DateRangePresetKey,
  now: number = Date.now(),
): DateRange {
  const today = startOfDay(new Date(now))

  switch (key) {
    case 'today': {
      const s = ymd(today)
      return { start: s, end: s }
    }
    case 'this-week': {
      const start = mondayOf(today)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      return { start: ymd(start), end: ymd(end) }
    }
    case 'this-month': {
      const y = today.getFullYear()
      const m = today.getMonth()
      const start = new Date(y, m, 1)
      const end = new Date(y, m + 1, 0) // last day of month
      return { start: ymd(start), end: ymd(end) }
    }
    case 'last-month': {
      const y = today.getFullYear()
      const m = today.getMonth()
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0) // last day of previous month
      return { start: ymd(start), end: ymd(end) }
    }
    case 'last-7': {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      return { start: ymd(start), end: ymd(today) }
    }
    case 'last-30': {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      return { start: ymd(start), end: ymd(today) }
    }
  }
}

/**
 * Inverse: given a (start, end) pair, return the preset key that matches
 * exactly, or null. Used to highlight the active chip.
 */
export function matchActivePreset(
  start: string,
  end: string,
  now: number = Date.now(),
): DateRangePresetKey | null {
  for (const key of PRESET_KEYS) {
    const r = getRangePreset(key, now)
    if (r.start === start && r.end === end) return key
  }
  return null
}

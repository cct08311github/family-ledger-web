/**
 * Pure helpers for the records page month-based navigation (Issue #185).
 * All dates use local timezone to match date input elements.
 */

export type DateString = string

export interface MonthRange {
  start: DateString
  end: DateString
  year: number
  month: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(d: Date): DateString {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function monthRange(year: number, month: number): MonthRange {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  return { start: toIso(first), end: toIso(last), year, month }
}

export function currentMonthRange(now: Date = new Date()): MonthRange {
  return monthRange(now.getFullYear(), now.getMonth() + 1)
}

export function shiftMonth(year: number, month: number, delta: number): MonthRange {
  const d = new Date(year, month - 1 + delta, 1)
  return monthRange(d.getFullYear(), d.getMonth() + 1)
}

export function parseYearMonth(dateStr: DateString): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateStr)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

export function isExactMonth(start: DateString, end: DateString): boolean {
  const ym = parseYearMonth(start)
  if (!ym) return false
  const expected = monthRange(ym.year, ym.month)
  return start === expected.start && end === expected.end
}

export function isCurrentMonth(start: DateString, end: DateString, now: Date = new Date()): boolean {
  const curr = currentMonthRange(now)
  return start === curr.start && end === curr.end
}

export function formatMonthLabel(range: Pick<MonthRange, 'year' | 'month'>): string {
  return `${range.year}/${pad2(range.month)}`
}

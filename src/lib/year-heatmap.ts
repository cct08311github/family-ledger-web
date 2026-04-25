import { toDate } from './utils'
import type { Expense } from './types'

export interface YearHeatmapCell {
  /** Date as YYYY-MM-DD (local). */
  date: string
  /** 0..6 — day-of-week (0 = Sunday). */
  dow: number
  /** 0-based week index from year start. */
  weekIndex: number
  amount: number
  /** 0..1 vs yearMax (0 when yearMax is 0). */
  intensity: number
}

export interface YearHeatmapData {
  cells: YearHeatmapCell[]
  yearMax: number
  yearTotal: number
  /** Days with positive spending. */
  daysWithSpend: number
  year: number
  /** Total weeks the grid spans. */
  weeksCount: number
}

interface BuildOptions {
  expenses: Expense[]
  year: number
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function daysInYear(y: number): number {
  return isLeap(y) ? 366 : 365
}

/**
 * Per-day spending grid for a calendar year, laid out GitHub-style:
 * dow on the row, week-of-year on the column. Intensity is normalized
 * vs the year's max daily spend so within-year structure is preserved.
 *
 * Returns null only when input is malformed (`year` non-finite). An
 * empty year still returns an all-zero grid so the caller can render
 * "no spending yet" with shape preserved.
 */
export function buildYearHeatmap({
  expenses,
  year,
}: BuildOptions): YearHeatmapData | null {
  if (!Number.isFinite(year)) return null

  const yearStart = new Date(year, 0, 1)
  const totalDays = daysInYear(year)

  const dailyTotals = new Map<string, number>()

  for (const e of expenses) {
    const amount = Number(e.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    let d: Date
    try {
      d = toDate(e.date)
    } catch {
      continue
    }
    if (!Number.isFinite(d.getTime())) continue
    if (d.getFullYear() !== year) continue
    const k = dateKey(d)
    dailyTotals.set(k, (dailyTotals.get(k) ?? 0) + amount)
  }

  let yearMax = 0
  let yearTotal = 0
  for (const v of dailyTotals.values()) {
    if (v > yearMax) yearMax = v
    yearTotal += v
  }

  const cells: YearHeatmapCell[] = []
  // First Sunday on or before Jan 1 — anchors weekIndex grid columns.
  const yearStartDow = yearStart.getDay()
  for (let i = 0; i < totalDays; i++) {
    const cur = new Date(year, 0, 1 + i)
    const dow = cur.getDay()
    const dayOfYear = i // 0-indexed
    const weekIndex = Math.floor((dayOfYear + yearStartDow) / 7)
    const k = dateKey(cur)
    const amount = dailyTotals.get(k) ?? 0
    const intensity = yearMax > 0 ? amount / yearMax : 0
    cells.push({ date: k, dow, weekIndex, amount, intensity })
  }

  const weeksCount = cells.length > 0 ? cells[cells.length - 1].weekIndex + 1 : 0

  return {
    cells,
    yearMax,
    yearTotal,
    daysWithSpend: dailyTotals.size,
    year,
    weeksCount,
  }
}

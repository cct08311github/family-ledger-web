import { toDate } from './utils'
import type { Expense } from './types'

export interface TrendPoint {
  /** Date as YYYY-MM-DD (local). */
  dateLabel: string
  /** Epoch ms — used for chart x-axis. */
  ts: number
  amount: number
}

export type PriceTrend = 'up' | 'down' | 'flat'

export interface PriceTrendData {
  /** Chronological points (oldest first). */
  series: TrendPoint[]
  averagePrice: number
  minPrice: number
  maxPrice: number
  /** Median split: avg(later half) vs avg(earlier half). */
  trend: PriceTrend
  /** Percent delta later vs earlier ((late - early) / early). null when input too small. */
  trendPct: number | null
  count: number
}

interface BuildOptions {
  expenses: Expense[]
  /** Description (raw — will be normalized). */
  description: string
  /** Days back to consider. Default 365. */
  days?: number
  /** Minimum matches to surface trend. Default 3. */
  minMatches?: number
  /** Maximum matches before bailing (signal-overload defence). Default 100. */
  maxMatches?: number
  /** Now in epoch ms; defaults to Date.now(). */
  now?: number
  /** Threshold for flat (|pct| ≤ this). Default 0.05 (5%). */
  flatThreshold?: number
}

function normalize(s: string): string {
  return (s ?? '').trim().toLowerCase()
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Build a price-over-time trend for purchases matching a single description.
 * Distinct from same-description-history (#307): that one is the form-side
 * anchor (last few entries + average); this one is the records-side
 * batch trend (chronological series + slope).
 */
export function buildPriceTrendSeries({
  expenses,
  description,
  days = 365,
  minMatches = 3,
  maxMatches = 100,
  now = Date.now(),
  flatThreshold = 0.05,
}: BuildOptions): PriceTrendData | null {
  const normalized = normalize(description)
  if (!normalized) return null

  const cutoff = now - days * 86_400_000
  const points: TrendPoint[] = []

  for (const e of expenses) {
    if (normalize(e.description) !== normalized) continue
    const amount = Number(e.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    let d: Date
    try {
      d = toDate(e.date)
    } catch {
      continue
    }
    const ts = d.getTime()
    if (!Number.isFinite(ts) || ts < cutoff || ts > now) continue
    points.push({ dateLabel: dateKey(d), ts, amount })
  }

  if (points.length < minMatches) return null
  if (points.length > maxMatches) return null

  points.sort((a, b) => a.ts - b.ts)

  let total = 0
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    total += p.amount
    if (p.amount < min) min = p.amount
    if (p.amount > max) max = p.amount
  }
  const averagePrice = total / points.length

  const half = Math.floor(points.length / 2)
  const earlier = points.slice(0, half)
  const later = points.slice(points.length - half)
  const earlierAvg =
    earlier.length > 0 ? earlier.reduce((s, p) => s + p.amount, 0) / earlier.length : 0
  const laterAvg =
    later.length > 0 ? later.reduce((s, p) => s + p.amount, 0) / later.length : 0

  let trendPct: number | null = null
  let trend: PriceTrend = 'flat'
  if (earlierAvg > 0 && half >= 1) {
    trendPct = (laterAvg - earlierAvg) / earlierAvg
    if (trendPct > flatThreshold) trend = 'up'
    else if (trendPct < -flatThreshold) trend = 'down'
    else trend = 'flat'
  }

  return {
    series: points,
    averagePrice,
    minPrice: min,
    maxPrice: max,
    trend,
    trendPct,
    count: points.length,
  }
}

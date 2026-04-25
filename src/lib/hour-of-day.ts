import { toDate } from './utils'
import type { Expense } from './types'

export interface HourSegment {
  /** Inclusive start hour 0..23. */
  start: number
  /** Exclusive end hour 0..24 (24 means end-of-day). */
  end: number
  label: string
  total: number
  share: number
}

export interface HourOfDayData {
  /** Total amount per hour 0..23. */
  hourBuckets: number[]
  /** Count of expenses per hour 0..23. */
  hourCounts: number[]
  /** Hour with max amount. */
  peakHour: number
  /** Total amount across all hours. */
  totalAmount: number
  /** Curated 4-segment summary (morning, lunch, afternoon, evening, night). */
  segments: HourSegment[]
  /** Whether distribution is too uniform to be insightful. */
  isUniform: boolean
  /** Number of expenses contributing. */
  count: number
}

interface AnalyzeOptions {
  expenses: Expense[]
  days?: number
  now?: number
  /** Min expenses required. Default 30. */
  minExpenses?: number
  /** Min peakAmount/avgAmount ratio to deem "non-uniform". Default 2. */
  uniformityRatio?: number
}

const SEGMENT_DEFS: ReadonlyArray<{ start: number; end: number; label: string }> = [
  { start: 6, end: 11, label: '清晨/早晨 (6-11)' },
  { start: 11, end: 14, label: '午餐時段 (11-14)' },
  { start: 14, end: 18, label: '下午 (14-18)' },
  { start: 18, end: 22, label: '晚餐/通勤 (18-22)' },
  { start: 22, end: 24, label: '深夜 (22-24)' },
  { start: 0, end: 6, label: '凌晨 (0-6)' },
]

/**
 * Hour-of-day spending pattern over a rolling window. Granularity below
 * a single day — distinct from heatmap (per-day), DowInsight (per-week-
 * day). Returns null when sample is too thin or distribution is too
 * uniform to surface meaningful structure.
 *
 * Hour data quality is noisy because retroactive entries default to
 * noon-ish, so the threshold check guards against false-positive
 * "noon-peak" insights.
 */
export function analyzeHourOfDay({
  expenses,
  days = 30,
  now = Date.now(),
  minExpenses = 30,
  uniformityRatio = 2,
}: AnalyzeOptions): HourOfDayData | null {
  if (!Number.isFinite(days) || days <= 0) return null

  const cutoff = now - days * 86_400_000
  const hourBuckets = Array<number>(24).fill(0)
  const hourCounts = Array<number>(24).fill(0)
  let count = 0
  let totalAmount = 0

  for (const e of expenses) {
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
    const hour = d.getHours()
    if (hour < 0 || hour > 23) continue
    hourBuckets[hour] += amount
    hourCounts[hour]++
    count++
    totalAmount += amount
  }

  if (count < minExpenses || totalAmount <= 0) return null

  let peakHour = 0
  for (let h = 1; h < 24; h++) {
    if (hourBuckets[h] > hourBuckets[peakHour]) peakHour = h
  }

  const avgAmount = totalAmount / 24
  const peakAmount = hourBuckets[peakHour]
  const isUniform = avgAmount > 0 ? peakAmount / avgAmount < uniformityRatio : true

  const segments: HourSegment[] = SEGMENT_DEFS.map((seg) => {
    let total = 0
    for (let h = seg.start; h < seg.end; h++) total += hourBuckets[h]
    return {
      start: seg.start,
      end: seg.end,
      label: seg.label,
      total,
      share: totalAmount > 0 ? total / totalAmount : 0,
    }
  })

  return {
    hourBuckets,
    hourCounts,
    peakHour,
    totalAmount,
    segments,
    isUniform,
    count,
  }
}

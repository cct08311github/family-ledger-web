import { toDate } from './utils'
import type { Settlement } from './types'

export interface SettlementCadenceData {
  /** Days since most recent settlement, ≥ 0. */
  daysSinceLast: number
  /** YYYY-MM-DD of most recent settlement (local). */
  lastSettlementDate: string
  /** Count of settlements in current calendar year (up to and including today). */
  ytdCount: number
  /** Total amount of settlements YTD. */
  ytdAmount: number
  /** Mean gap (days) between consecutive settlements over all history. null when < 2 settlements. */
  avgDaysBetween: number | null
  /** Largest gap (days) between consecutive settlements. null when < 2. */
  longestGap: number | null
}

interface AnalyzeOptions {
  settlements: Settlement[]
  now?: number
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Cadence statistics over the family's settlement history. Distinct from
 * the existing settlement list (which shows individual records) and the
 * unsettled debt view (which shows the current snapshot) — this surfaces
 * the *rhythm* of settlement, which can prompt action ("X days since last,
 * we usually do this every Y").
 */
export function analyzeSettlementCadence({
  settlements,
  now = Date.now(),
}: AnalyzeOptions): SettlementCadenceData | null {
  const valid: Array<{ ts: number; amount: number; dateLabel: string }> = []

  for (const s of settlements) {
    const amount = Number(s.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    let d: Date
    try {
      d = toDate(s.date)
    } catch {
      continue
    }
    const ts = d.getTime()
    if (!Number.isFinite(ts) || ts <= 0 || ts > now) continue
    valid.push({ ts, amount, dateLabel: dateKey(d) })
  }

  if (valid.length === 0) return null

  valid.sort((a, b) => a.ts - b.ts)

  const last = valid[valid.length - 1]
  const daysSinceLast = Math.max(
    0,
    Math.floor((now - last.ts) / 86_400_000),
  )

  const today = new Date(now)
  const yearStartMs = new Date(today.getFullYear(), 0, 1).getTime()
  let ytdCount = 0
  let ytdAmount = 0
  for (const s of valid) {
    if (s.ts >= yearStartMs) {
      ytdCount++
      ytdAmount += s.amount
    }
  }

  let avgDaysBetween: number | null = null
  let longestGap: number | null = null
  if (valid.length >= 2) {
    let totalGap = 0
    let max = 0
    for (let i = 1; i < valid.length; i++) {
      const gap = (valid[i].ts - valid[i - 1].ts) / 86_400_000
      totalGap += gap
      if (gap > max) max = gap
    }
    avgDaysBetween = totalGap / (valid.length - 1)
    longestGap = max
  }

  return {
    daysSinceLast,
    lastSettlementDate: last.dateLabel,
    ytdCount,
    ytdAmount,
    avgDaysBetween,
    longestGap,
  }
}

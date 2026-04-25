'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { aggregateDailyBuckets, type DailyBucket } from '@/lib/spending-heatmap'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface SpendingHeatmapProps {
  expenses: Expense[]
  /** Number of days back from today, inclusive. Default 30. */
  days?: number
}

function bucketColor(intensity: number): string {
  // 0 → muted gray; >0 → primary tint scaling by intensity (using OKLCH
  // alpha mix so it respects light/dark themes via CSS vars).
  if (intensity <= 0) return 'var(--muted)'
  // Map intensity (0..1) to alpha 15..85% of var(--primary)
  const alpha = 15 + Math.round(intensity * 70)
  return `color-mix(in oklch, var(--primary) ${alpha}%, transparent)`
}

function dowLabel(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return ['日', '一', '二', '三', '四', '五', '六'][wd]
}

/**
 * 30-day spending heatmap (Issue #290). Square grid where each cell is one
 * day, tinted by share of the window's max daily spend. Click → drill down
 * to /records filtered to that day.
 */
export function SpendingHeatmap({ expenses, days = 30 }: SpendingHeatmapProps) {
  const buckets = useMemo(
    () => aggregateDailyBuckets({ expenses, days }),
    [expenses, days],
  )

  const total = useMemo(
    () => buckets.reduce((s, b) => s + b.total, 0),
    [buckets],
  )

  if (total === 0) return null

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--muted-foreground)]">
          📅 最近 {days} 天 · 每日花費熱力圖
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">
          總計 {currency(total)}
        </div>
      </div>
      <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
        {buckets.map((b) => (
          <DayCell key={b.date} bucket={b} />
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
        <span>少</span>
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: bucketColor(0) }} />
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: bucketColor(0.25) }} />
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: bucketColor(0.5) }} />
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: bucketColor(0.75) }} />
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: bucketColor(1) }} />
        <span>多</span>
      </div>
    </div>
  )
}

function DayCell({ bucket }: { bucket: DailyBucket }) {
  const [, m, d] = bucket.date.split('-')
  const label = bucket.total > 0
    ? `${m}/${parseInt(d, 10)}（${dowLabel(bucket.date)}）${currency(bucket.total)}（${bucket.count} 筆）`
    : `${m}/${parseInt(d, 10)}（${dowLabel(bucket.date)}）無記錄`

  if (bucket.total === 0) {
    return (
      <div
        className="aspect-square rounded-sm"
        style={{ backgroundColor: bucketColor(0) }}
        title={label}
        aria-label={label}
      />
    )
  }

  return (
    <Link
      href={`/records?start=${bucket.date}&end=${bucket.date}`}
      className="aspect-square rounded-sm hover:ring-2 hover:ring-[var(--primary)] transition-all"
      style={{ backgroundColor: bucketColor(bucket.intensity) }}
      title={label}
      aria-label={label}
    />
  )
}

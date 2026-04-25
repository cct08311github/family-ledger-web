'use client'

import { useMemo } from 'react'
import { analyzeHourOfDay } from '@/lib/hour-of-day'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface HourOfDayPatternProps {
  expenses: Expense[]
  /** Window length back from today. Default 30. */
  days?: number
}

/**
 * Hour-of-day spending pattern (Issue #329). Sub-day granularity — the
 * one time scale no other widget covers. Renders silently when sample
 * is too thin or distribution too uniform; the threshold check guards
 * against noisy "noon-peak" insights from retroactive entries.
 */
export function HourOfDayPattern({ expenses, days = 30 }: HourOfDayPatternProps) {
  const data = useMemo(
    () => analyzeHourOfDay({ expenses, days }),
    [expenses, days],
  )

  if (!data || data.isUniform) return null

  const max = Math.max(...data.hourBuckets, 1)
  const topSegments = [...data.segments]
    .filter((s) => s.share >= 0.1)
    .sort((a, b) => b.share - a.share)
    .slice(0, 2)

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        🕐 一天花費高峰（{days} 天分布）
      </div>

      {topSegments.length > 0 && (
        <div className="space-y-1">
          {topSegments.map((seg) => (
            <p key={seg.start} className="text-sm text-[var(--foreground)]">
              <span className="font-medium">{seg.label}</span> 佔 {Math.round(seg.share * 100)}%（
              {currency(seg.total)}）
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-24 gap-px pt-1" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
        {data.hourBuckets.map((amount, h) => {
          const heightPct = max > 0 ? (amount / max) * 100 : 0
          return (
            <div
              key={h}
              className="flex flex-col items-center justify-end h-9"
              title={`${String(h).padStart(2, '0')}:00 ${currency(amount)}`}
            >
              <div
                className="w-full rounded-t-sm"
                style={{
                  height: `${heightPct}%`,
                  minHeight: amount > 0 ? '2px' : '0',
                  backgroundColor:
                    h === data.peakHour
                      ? 'var(--primary)'
                      : 'color-mix(in oklch, var(--primary) 35%, transparent)',
                }}
                aria-label={`${h} 點 ${currency(amount)}`}
              />
            </div>
          )
        })}
      </div>

      <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import {
  analyzeDayOfWeekPattern,
  dowLabelTC,
  isInsightWorthShowing,
  type DowInsightData,
} from '@/lib/dow-insight'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface DowInsightProps {
  expenses: Expense[]
  /** Window length back from today. Default 60. */
  days?: number
}

function composeSentences(d: DowInsightData): string[] {
  const sentences: string[] = []

  if (d.peakRatio !== null && d.peakRatio >= 1.5 && d.lowestDow !== null) {
    const peakAvg = d.averages[d.peakDow]
    sentences.push(
      `你週${dowLabelTC(d.peakDow)}平均花費 ${currency(peakAvg)}，是週${dowLabelTC(d.lowestDow)}的 ${d.peakRatio.toFixed(1)} 倍`,
    )
  }

  if (d.weekendShare >= 0.55) {
    const pct = Math.round(d.weekendShare * 100)
    sentences.push(`週末（六/日）佔了本週 ${pct}% 的支出`)
  } else if (d.weekendShare > 0 && d.weekendShare <= 0.2) {
    const pct = Math.round(d.weekendShare * 100)
    sentences.push(`你是平日支出派 — 週末只佔 ${pct}%`)
  }

  return sentences
}

/**
 * Day-of-week pattern insight (Issue #292). Surfaces cyclical spending
 * habits the user may not consciously notice — peak weekday, weekend
 * concentration. Renders a mini bar chart for the seven weekdays so the
 * narrative claim is visually verifiable.
 */
export function DowInsight({ expenses, days = 60 }: DowInsightProps) {
  const data = useMemo(
    () => analyzeDayOfWeekPattern({ expenses, days }),
    [expenses, days],
  )

  if (!data || !isInsightWorthShowing(data)) return null

  const sentences = composeSentences(data)
  if (sentences.length === 0) return null

  const max = Math.max(...data.averages, 1)

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        🗓️ 最近 {data.windowDays} 天 · 週幾花費模式
      </div>

      <div className="space-y-1.5">
        {sentences.map((s, i) => (
          <p
            key={i}
            className="text-sm leading-relaxed text-[var(--foreground)]"
            style={i === 0 ? { fontWeight: 500 } : undefined}
          >
            {s}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 pt-1">
        {data.averages.map((avg, i) => {
          const h = max > 0 ? Math.max(4, Math.round((avg / max) * 32)) : 4
          const isPeak = i === data.peakDow && avg > 0
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="flex items-end h-9 w-full">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${h}px`,
                    backgroundColor: isPeak
                      ? 'var(--primary)'
                      : 'color-mix(in oklch, var(--primary) 35%, transparent)',
                  }}
                  title={`週${dowLabelTC(i)} ${currency(avg)}/次`}
                  aria-label={`週${dowLabelTC(i)} 平均 ${currency(avg)}`}
                />
              </div>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {dowLabelTC(i)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

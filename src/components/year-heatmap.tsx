'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { buildYearHeatmap, type YearHeatmapCell } from '@/lib/year-heatmap'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface YearHeatmapProps {
  expenses: Expense[]
  year: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function cellColor(intensity: number): string {
  if (intensity <= 0) return 'var(--muted)'
  const alpha = 15 + Math.round(intensity * 75)
  return `color-mix(in oklch, var(--primary) ${alpha}%, transparent)`
}

function ariaLabel(c: YearHeatmapCell): string {
  if (c.amount <= 0) return `${c.date} 無記錄`
  return `${c.date} ${currency(c.amount)}`
}

function tooltip(c: YearHeatmapCell): string {
  if (c.amount <= 0) return `${c.date} · 無記錄`
  return `${c.date} · ${currency(c.amount)}`
}

/**
 * Full-year per-day spending heatmap (Issue #313). GitHub-style 7×52
 * grid laid out by week-of-year × day-of-week. Distinct from home-page
 * SpendingHeatmap (#290) which uses a 30-day rolling window — this is
 * the seasonal-pattern lens.
 */
export function YearHeatmap({ expenses, year }: YearHeatmapProps) {
  const data = useMemo(
    () => buildYearHeatmap({ expenses, year }),
    [expenses, year],
  )

  if (!data || data.yearTotal === 0) return null

  const cellsByPos = new Map<string, YearHeatmapCell>()
  for (const c of data.cells) {
    cellsByPos.set(`${c.weekIndex}-${c.dow}`, c)
  }

  const monthMarkers: Array<{ weekIndex: number; label: string }> = []
  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(year, m, 1)
    const dayOfYear = Math.floor(
      (firstOfMonth.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000,
    )
    const weekIndex = Math.floor((dayOfYear + new Date(year, 0, 1).getDay()) / 7)
    monthMarkers.push({ weekIndex, label: MONTH_LABELS[m] })
  }

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-semibold text-[var(--muted-foreground)]">
          📅 {year} 全年花費熱力 · 已記 {data.daysWithSpend} 天 · 累計{' '}
          {currency(data.yearTotal)}
        </div>
        <div className="text-[10px] text-[var(--muted-foreground)]">
          單日最高 {currency(data.yearMax)}
        </div>
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="flex pl-7 mb-1 gap-px">
            {monthMarkers.map((m, i) => (
              <span
                key={i}
                className="text-[9px] text-[var(--muted-foreground)]"
                style={{
                  width: `calc(${
                    i < 11
                      ? monthMarkers[i + 1].weekIndex - m.weekIndex
                      : data.weeksCount - m.weekIndex
                  } * (10px + 1px))`,
                  flexShrink: 0,
                }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-[1px]">
            {/* DOW labels */}
            <div className="flex flex-col gap-[1px] mr-1">
              {DOW_LABELS.map((d, i) => (
                <span
                  key={i}
                  className="text-[9px] leading-[10px] text-[var(--muted-foreground)] h-[10px] w-5 text-right pr-0.5"
                >
                  {i % 2 === 1 ? d : ''}
                </span>
              ))}
            </div>

            {/* Cells: column per week */}
            {Array.from({ length: data.weeksCount }, (_, w) => (
              <div key={w} className="flex flex-col gap-[1px]">
                {Array.from({ length: 7 }, (_, dow) => {
                  const cell = cellsByPos.get(`${w}-${dow}`)
                  if (!cell) {
                    return <div key={dow} className="w-[10px] h-[10px]" />
                  }
                  if (cell.amount > 0) {
                    return (
                      <Link
                        key={dow}
                        href={`/records?start=${cell.date}&end=${cell.date}`}
                        className="w-[10px] h-[10px] rounded-sm hover:ring-1 hover:ring-[var(--primary)] transition"
                        style={{ backgroundColor: cellColor(cell.intensity) }}
                        title={tooltip(cell)}
                        aria-label={ariaLabel(cell)}
                      />
                    )
                  }
                  return (
                    <div
                      key={dow}
                      className="w-[10px] h-[10px] rounded-sm"
                      style={{ backgroundColor: cellColor(cell.intensity) }}
                      title={tooltip(cell)}
                      aria-label={ariaLabel(cell)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
        <span>少</span>
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellColor(0) }} />
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellColor(0.25) }} />
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellColor(0.5) }} />
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellColor(0.75) }} />
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellColor(1) }} />
        <span>多</span>
      </div>
    </div>
  )
}

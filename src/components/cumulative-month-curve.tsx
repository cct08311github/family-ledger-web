'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { buildCumulativeMonthCurve } from '@/lib/cumulative-month-curve'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface CumulativeMonthCurveProps {
  expenses: Expense[]
  selectedMonth: { year: number; month: number }
}

/**
 * Cumulative day-by-day spending curve (Issue #348). Dual-line chart
 * showing current month's running total against last month's full
 * trajectory — visual answer to "am I ahead or behind last month's pace
 * today?". Renders silently when no current-month data or month too
 * young.
 */
export function CumulativeMonthCurve({
  expenses,
  selectedMonth,
}: CumulativeMonthCurveProps) {
  const data = useMemo(
    () =>
      buildCumulativeMonthCurve({
        expenses,
        year: selectedMonth.year,
        month: selectedMonth.month,
      }),
    [expenses, selectedMonth.year, selectedMonth.month],
  )

  if (!data) return null

  // Merge into one array indexed by day so recharts can plot dual lines
  const chartData: Array<{ day: number; current: number | null; previous: number | null }> = []
  const maxDay = Math.max(
    data.daysInMonth,
    data.previous?.length ?? 0,
  )
  for (let day = 1; day <= maxDay; day++) {
    chartData.push({
      day,
      current: data.current[day - 1]?.cumulative ?? null,
      previous: data.previous?.[day - 1]?.cumulative ?? null,
    })
  }

  let comparisonText: { text: string; color: string } | null = null
  if (data.prevSameDayCumulative !== null && data.prevSameDayCumulative > 0) {
    const delta = data.todayCumulative - data.prevSameDayCumulative
    const pct = Math.round((delta / data.prevSameDayCumulative) * 100)
    if (pct > 0) {
      comparisonText = {
        text: `↑ 比上月同期多 ${pct}%（${currency(Math.abs(delta))}）`,
        color: 'var(--destructive)',
      }
    } else if (pct < 0) {
      comparisonText = {
        text: `↓ 比上月同期少 ${Math.abs(pct)}%（${currency(Math.abs(delta))}）`,
        color: 'var(--primary)',
      }
    } else {
      comparisonText = {
        text: '→ 與上月同期相當',
        color: 'var(--muted-foreground)',
      }
    }
  }

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-semibold text-[var(--muted-foreground)]">
          📈 每日累計支出 · {data.monthLabel}
        </div>
        {data.previous !== null && (
          <div className="text-[11px] text-[var(--muted-foreground)]">
            灰線：{data.previousMonthLabel}
          </div>
        )}
      </div>

      <div className="h-[180px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, maxDay]}
              tick={{ fontSize: 10 }}
              stroke="var(--muted-foreground)"
              ticks={[1, 5, 10, 15, 20, 25, maxDay].filter((d) => d <= maxDay)}
            />
            <YAxis
              tickFormatter={(v) => currency(v as number)}
              tick={{ fontSize: 10 }}
              stroke="var(--muted-foreground)"
              width={70}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null
                const p = payload[0].payload as {
                  day: number
                  current: number | null
                  previous: number | null
                }
                return (
                  <div className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs shadow space-y-0.5">
                    <div className="font-medium">第 {label} 天</div>
                    {p.current !== null && (
                      <div className="text-[var(--primary)]">
                        本月：{currency(p.current)}
                      </div>
                    )}
                    {p.previous !== null && (
                      <div className="text-[var(--muted-foreground)]">
                        上月：{currency(p.previous)}
                      </div>
                    )}
                  </div>
                )
              }}
            />
            {data.previous !== null && (
              <Line
                type="monotone"
                dataKey="previous"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 3"
                connectNulls
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="current"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <ReferenceLine
              x={data.todayDay}
              stroke="var(--foreground)"
              strokeOpacity={0.2}
              strokeDasharray="2 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
        <span className="text-[var(--muted-foreground)]">
          目前累計（第 {data.todayDay} 天）：
        </span>
        <span className="font-semibold text-[var(--foreground)]">
          {currency(data.todayCumulative)}
        </span>
        {comparisonText && (
          <span style={{ color: comparisonText.color }}>{comparisonText.text}</span>
        )}
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { buildPriceTrendSeries } from '@/lib/description-price-trend'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface DescriptionPriceTrendProps {
  expenses: Expense[]
  description: string
}

const TREND_LABELS = {
  up: { icon: '↑', label: '價格趨勢上升', color: 'var(--destructive)' },
  down: { icon: '↓', label: '價格趨勢下降', color: 'var(--primary)' },
  flat: { icon: '→', label: '價格趨勢穩定', color: 'var(--muted-foreground)' },
} as const

/**
 * Inline price trend visualization for the records page when a single
 * description is being searched (Issue #309). Uses a scatter plot rather
 * than a line because each point is a discrete purchase event — drawing
 * straight lines between would imply continuity that doesn't exist.
 */
export function DescriptionPriceTrend({
  expenses,
  description,
}: DescriptionPriceTrendProps) {
  const data = useMemo(
    () => buildPriceTrendSeries({ expenses, description }),
    [expenses, description],
  )

  if (!data) return null

  const trendInfo = TREND_LABELS[data.trend]
  const pctText =
    data.trendPct !== null
      ? `${data.trendPct > 0 ? '+' : ''}${Math.round(data.trendPct * 100)}%`
      : ''

  const chartData = data.series.map((p) => ({
    x: p.ts,
    y: p.amount,
    label: p.dateLabel,
  }))

  return (
    <div className="card p-4 md:p-5 space-y-2 mb-4 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-semibold text-[var(--muted-foreground)]">
          📈 「{description}」價格走勢 · {data.count} 筆
        </div>
        <div className="text-xs" style={{ color: trendInfo.color }}>
          {trendInfo.icon} {trendInfo.label}
          {pctText && ` (${pctText})`}
        </div>
      </div>

      <div className="h-[140px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(ts) => {
                const d = new Date(ts)
                return `${d.getMonth() + 1}/${d.getDate()}`
              }}
              tick={{ fontSize: 10 }}
              stroke="var(--muted-foreground)"
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={['dataMin - 50', 'dataMax + 50']}
              tickFormatter={(v) => currency(v as number)}
              tick={{ fontSize: 10 }}
              stroke="var(--muted-foreground)"
              width={60}
            />
            <ReferenceLine
              y={data.averagePrice}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              label={{
                value: `平均 ${currency(data.averagePrice)}`,
                position: 'right',
                fill: 'var(--muted-foreground)',
                fontSize: 10,
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const p = payload[0].payload as { x: number; y: number; label: string }
                return (
                  <div className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs shadow">
                    <div className="font-medium">{p.label}</div>
                    <div className="text-[var(--primary)]">{currency(p.y)}</div>
                  </div>
                )
              }}
            />
            <Scatter
              data={chartData}
              fill="var(--primary)"
              shape="circle"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted-foreground)]">
        <span>最低 {currency(data.minPrice)}</span>
        <span>最高 {currency(data.maxPrice)}</span>
        <span>平均 {currency(data.averagePrice)}</span>
      </div>
    </div>
  )
}

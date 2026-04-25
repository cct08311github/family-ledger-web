'use client'

import { useMemo } from 'react'
import { analyzeSettlementCadence } from '@/lib/settlement-cadence'
import { currency } from '@/lib/utils'
import type { Settlement } from '@/lib/types'

interface SettlementCadenceProps {
  settlements: Settlement[]
}

/**
 * Settlement-cadence statistics card for the /split page (Issue #311).
 * Surfaces the rhythm of family settlements: how recent, how often, how
 * much. Renders silently when there's no settlement history yet.
 */
export function SettlementCadence({ settlements }: SettlementCadenceProps) {
  const data = useMemo(
    () => analyzeSettlementCadence({ settlements }),
    [settlements],
  )

  if (!data) return null

  const sinceLastLabel =
    data.daysSinceLast === 0
      ? '今天結算'
      : data.daysSinceLast === 1
        ? '昨天結算'
        : `${data.daysSinceLast} 天前結算（${data.lastSettlementDate}）`

  return (
    <div
      className="card p-5 md:p-6 space-y-2 animate-fade-up"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--primary) 4%, transparent)',
      }}
    >
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        ⚖ 結算節奏
      </div>
      <p className="text-sm font-medium text-[var(--foreground)]">
        上次{sinceLastLabel}
      </p>
      <p className="text-xs text-[var(--muted-foreground)]">
        今年已結算 <span className="text-[var(--foreground)]">{data.ytdCount}</span>{' '}
        次，累計{' '}
        <span className="text-[var(--foreground)]">{currency(data.ytdAmount)}</span>
      </p>
      {data.avgDaysBetween !== null && data.longestGap !== null && (
        <p className="text-xs text-[var(--muted-foreground)]">
          平均每 {Math.round(data.avgDaysBetween)} 天結算一次｜最久{' '}
          {Math.round(data.longestGap)} 天
        </p>
      )}
    </div>
  )
}

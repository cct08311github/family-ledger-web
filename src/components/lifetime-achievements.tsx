'use client'

import { useMemo } from 'react'
import { aggregateLifetimeStats } from '@/lib/lifetime-stats'
import { currency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface LifetimeAchievementsProps {
  expenses: Expense[]
}

/**
 * Lifetime self-narrative card for the settings page (Issue #327). All
 * other widgets are analytical / temporal; this one is commemorative —
 * "我們的記帳成就". For long-running families it grows in emotional
 * value over time.
 */
export function LifetimeAchievements({ expenses }: LifetimeAchievementsProps) {
  const data = useMemo(
    () => aggregateLifetimeStats({ expenses }),
    [expenses],
  )

  if (!data) return null

  const recordingPct = Math.round(data.recordingRate * 100)
  const yearLabel =
    data.highestMonth.label && /^\d{4}-\d{2}$/.test(data.highestMonth.label)
      ? `${data.highestMonth.label.slice(0, 4)} 年 ${parseInt(data.highestMonth.label.slice(5), 10)} 月`
      : data.highestMonth.label

  return (
    <div
      className="card p-5 md:p-6 space-y-3 animate-fade-up"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--primary) 4%, transparent)',
      }}
    >
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        🏆 我們的記帳成就
      </div>

      <p className="text-sm text-[var(--foreground)]">
        從 <span className="font-semibold">{data.firstRecordDate}</span> 開始記帳
        （已 {data.totalDaysSinceFirst} 天）
      </p>
      <p className="text-sm text-[var(--foreground)]">
        累計 <span className="font-semibold">{data.totalCount}</span> 筆 ·{' '}
        <span className="font-semibold text-[var(--primary)]">
          {currency(data.totalAmount)}
        </span>
      </p>

      <ul className="space-y-1 text-xs text-[var(--foreground)] pt-1 border-t border-[var(--border)]">
        <li>
          🥇 最大單筆：
          <span className="font-medium">
            {currency(data.biggestSingleExpense.amount)}
          </span>{' '}
          <span className="text-[var(--muted-foreground)]">
            ({data.biggestSingleExpense.description}, {data.biggestSingleExpense.date})
          </span>
        </li>
        <li>
          📅 最高月：
          <span className="font-medium">{currency(data.highestMonth.amount)}</span>{' '}
          <span className="text-[var(--muted-foreground)]">({yearLabel})</span>
        </li>
        <li>
          🔥 最長連續記帳：
          <span className="font-medium">{data.longestStreak}</span> 天
        </li>
        <li>
          📊 記帳率：
          <span className="font-medium">{recordingPct}%</span>{' '}
          <span className="text-[var(--muted-foreground)]">
            ({data.daysRecorded} / {data.totalDaysSinceFirst} 天有記)
          </span>
        </li>
      </ul>
    </div>
  )
}

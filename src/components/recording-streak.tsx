'use client'

import { useMemo } from 'react'
import { computeRecordingStreak } from '@/lib/recording-streak'
import type { Expense } from '@/lib/types'

interface RecordingStreakProps {
  expenses: Expense[]
}

/**
 * Recording-consistency streak (Issue #294). A small, gentle gamification
 * card. Always renders (when there's any data) — both as encouragement
 * when the streak is going and as a low-pressure invitation to restart
 * after a break. Uses `createdAt`, not `date`, so back-filling can't fake
 * a streak.
 */
export function RecordingStreak({ expenses }: RecordingStreakProps) {
  const data = useMemo(
    () => computeRecordingStreak({ expenses }),
    [expenses],
  )

  if (!data) return null

  const { currentStreak, longestStreak, daysRecordedThisMonth, daysInMonthSoFar, isNewRecord } = data
  const monthRate =
    daysInMonthSoFar > 0
      ? Math.round((daysRecordedThisMonth / daysInMonthSoFar) * 100)
      : 0

  const headline = (() => {
    if (currentStreak === 0 && longestStreak > 0) {
      return `上次連續 ${longestStreak} 天 — 今天再開始？`
    }
    if (isNewRecord && currentStreak >= 2) {
      return `🎉 新紀錄！連續記帳 ${currentStreak} 天`
    }
    if (currentStreak === 1) {
      return `🌱 今天有記帳，繼續加油`
    }
    return `🔥 連續記帳 ${currentStreak} 天`
  })()

  const showBest = !isNewRecord && longestStreak > currentStreak && longestStreak >= 3

  return (
    <div className="card p-5 md:p-6 space-y-2 animate-fade-up">
      <div className="text-xs font-semibold text-[var(--muted-foreground)]">
        ✨ 記帳習慣
      </div>
      <p className="text-sm font-medium text-[var(--foreground)]">{headline}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
        {showBest && <span>歷史最佳 {longestStreak} 天</span>}
        <span>
          本月 {daysRecordedThisMonth} / {daysInMonthSoFar} 天 ({monthRate}%)
        </span>
      </div>
      {currentStreak > 0 && (
        <div className="flex gap-1 pt-1">
          {Array.from({ length: Math.min(currentStreak, 14) }).map((_, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  i < currentStreak
                    ? 'var(--primary)'
                    : 'color-mix(in oklch, var(--primary) 30%, transparent)',
              }}
              aria-hidden
            />
          ))}
          {currentStreak > 14 && (
            <span className="text-[10px] text-[var(--muted-foreground)] ml-1">
              +{currentStreak - 14}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { currency, toDate } from '@/lib/utils'
import { getTodayExpenses, getWeekExpenses } from '@/lib/hooks/use-expenses'
import type { Expense } from '@/lib/types'

interface TodaySummaryProps {
  expenses: Expense[]
  loading?: boolean
}

export function TodaySummary({ expenses, loading }: TodaySummaryProps) {
  const todayExpenses = useMemo(() => getTodayExpenses(expenses), [expenses])
  const thisWeek = useMemo(() => getWeekExpenses(expenses, 0), [expenses])
  const lastWeekSameRange = useMemo(() => getWeekExpenses(expenses, -1), [expenses])

  const todayTotal = useMemo(() => todayExpenses.reduce((s, e) => s + e.amount, 0), [todayExpenses])
  const weekTotal = useMemo(() => thisWeek.reduce((s, e) => s + e.amount, 0), [thisWeek])
  const lastWeekTotal = useMemo(() => lastWeekSameRange.reduce((s, e) => s + e.amount, 0), [lastWeekSameRange])

  // 本月/上月數據
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  const monthTotal = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return expenses.filter((e) => toDate(e.date) >= start).reduce((s, e) => s + e.amount, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses])

  // 上月同期支出（day 1 ~ 對應日）—— 用來做「照這速度 vs 上月同期」對比
  const lastMonthSameRangeTotal = useMemo(() => {
    const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lmEnd = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth + 1) // exclusive
    return expenses.filter((e) => {
      const d = toDate(e.date)
      return d >= lmStart && d < lmEnd
    }).reduce((s, e) => s + e.amount, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, dayOfMonth])

  // 月底預估 = 每日平均 × 當月總天數
  const dailyAvg = dayOfMonth > 0 ? monthTotal / dayOfMonth : 0
  const projectedMonthTotal = Math.round(dailyAvg * daysInMonth)

  // 同期對比（相對上月同期）
  const sameRangeDiff = lastMonthSameRangeTotal > 0
    ? Math.round(((monthTotal - lastMonthSameRangeTotal) / lastMonthSameRangeTotal) * 100)
    : null

  // 週對比
  const weekDiff = lastWeekTotal > 0 ? Math.round(((weekTotal - lastWeekTotal) / lastWeekTotal) * 100) : null

  if (loading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="h-4 bg-[var(--muted)] rounded w-24 mb-3" />
        <div className="h-8 bg-[var(--muted)] rounded w-32" />
      </div>
    )
  }

  return (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up">
      <div className="grid grid-cols-3 gap-4">
        {/* 今日支出 */}
        <div className="text-center">
          <div className="text-xs text-[var(--muted-foreground)] mb-1">☀️ 今日支出</div>
          <div className="text-2xl font-black" style={{ color: todayTotal > 0 ? 'var(--primary)' : 'var(--muted-foreground)' }}>
            {todayTotal > 0 ? currency(todayTotal) : 'NT$ 0'}
          </div>
          {todayTotal === 0 && (
            <div className="text-xs text-[var(--muted-foreground)] mt-1">還沒有記錄</div>
          )}
        </div>

        {/* 本週支出 */}
        <div className="text-center">
          <div className="text-xs text-[var(--muted-foreground)] mb-1">📅 本週支出</div>
          <div className="text-lg font-bold">{currency(weekTotal)}</div>
          {weekDiff !== null && (
            <div className={`text-xs mt-1 ${weekDiff > 0 ? 'text-[var(--destructive)]' : 'text-green-600 dark:text-green-400'}`}>
              {weekDiff > 0 ? '↑' : '↓'} {Math.abs(weekDiff)}% vs 上週
            </div>
          )}
        </div>

        {/* 月底預估 */}
        <div className="text-center">
          <div className="text-xs text-[var(--muted-foreground)] mb-1">🔮 月底預估</div>
          <div className="text-lg font-bold">{currency(projectedMonthTotal)}</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1">
            照每日 {currency(Math.round(dailyAvg))}
          </div>
        </div>
      </div>

      {/* 同期對比 (full width below) — 只在有上月資料時顯示 */}
      {sameRangeDiff !== null && (
        <div className="pt-3 border-t border-[var(--border)] text-xs text-center">
          <span className="text-[var(--muted-foreground)]">
            本月至 {dayOfMonth} 日支出 {currency(monthTotal)}，
          </span>
          {sameRangeDiff === 0 ? (
            <span className="text-[var(--muted-foreground)]">與上月同期持平</span>
          ) : (
            <span className={sameRangeDiff > 0 ? 'text-[var(--destructive)] font-medium' : 'text-green-600 dark:text-green-400 font-medium'}>
              比上月同期{sameRangeDiff > 0 ? '多花' : '少花'} {Math.abs(sameRangeDiff)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { currency } from '@/lib/utils'
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

  // 每日平均 = 本月總支出 / 本月已過天數
  const now = new Date()
  const dayOfMonth = now.getDate()
  const monthTotal = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return expenses.filter((e) => {
      const d = new Date(typeof e.date === 'object' && 'toDate' in e.date ? e.date.toDate() : e.date)
      return d >= start
    }).reduce((s, e) => s + e.amount, 0)
  }, [expenses])
  const dailyAvg = dayOfMonth > 0 ? Math.round(monthTotal / dayOfMonth) : 0

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

        {/* 每日平均 */}
        <div className="text-center">
          <div className="text-xs text-[var(--muted-foreground)] mb-1">📊 每日平均</div>
          <div className="text-lg font-bold">{currency(dailyAvg)}</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1">本月至今</div>
        </div>
      </div>
    </div>
  )
}

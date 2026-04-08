'use client'

import { useMemo } from 'react'
import { useGroupData } from '@/lib/group-data-context'
import { useAuth } from '@/lib/auth'
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

/**
 * Returns expenses visible to the current user.
 * - Shared expenses (isShared=true): visible to all group members
 * - Personal expenses (isShared=false): only visible to the creator
 */
export function useExpenses() {
  const { expenses: allExpenses, expensesLoading: loading } = useGroupData()
  const { user } = useAuth()

  const expenses = useMemo(() => {
    if (!user) return allExpenses
    return allExpenses.filter((e) => e.isShared || e.createdBy === user.uid)
  }, [allExpenses, user])

  return { expenses, loading }
}

/** 本月支出 */
export function useMonthlyExpenses(expenses: Expense[]) {
  return useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return expenses.filter((e) => toDate(e.date) >= start)
  }, [expenses])
}

/** 最近 N 筆 */
export function useRecentExpenses(expenses: Expense[], count: number) {
  return useMemo(() => expenses.slice(0, count), [expenses, count])
}

/** 取得今日支出 */
export function getTodayExpenses(expenses: Expense[]): Expense[] {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()
  return expenses.filter((e) => {
    const ed = toDate(e.date)
    return ed.getFullYear() === y && ed.getMonth() === m && ed.getDate() === d
  })
}

/** 取得指定週的支出（weekOffset: 0=本週, -1=上週） */
export function getWeekExpenses(expenses: Expense[], weekOffset = 0): Expense[] {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 7)
  return expenses.filter((e) => {
    const ed = toDate(e.date)
    return ed >= monday && ed < sunday
  })
}

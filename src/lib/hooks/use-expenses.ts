'use client'

import { useMemo } from 'react'
import { useGroupData } from '@/lib/group-data-context'
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

export function useExpenses(_groupId?: string) {
  const { expenses, expensesLoading: loading } = useGroupData()
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

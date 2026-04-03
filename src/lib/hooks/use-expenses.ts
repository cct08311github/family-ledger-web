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
export function useExpenses(_groupId?: string) {
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

'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

import { logger } from '@/lib/logger'

export function useExpenses(groupId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    // Path: groups/{groupId}/expenses
    const q = query(collection(db, 'groups', groupId, 'expenses'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense))
        setLoading(false)
      },
      (err) => {
        logger.error('[useExpenses] Snapshot error:', err)
        setLoading(false)
      },
    )
    return unsub
  }, [groupId])

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

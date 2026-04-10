'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useGroup } from '@/lib/hooks/use-group'
import type { RecurringExpense } from '@/lib/types'
import { logger } from '@/lib/logger'

export function useRecurringExpenses() {
  const { group } = useGroup()
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!group?.id) { setLoading(false); return }
    const q = query(collection(db, 'groups', group.id, 'recurringExpenses'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => { setRecurringExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RecurringExpense)); setLoading(false) },
      (err) => { logger.error('[RecurringExpenses] snapshot error:', err); setLoading(false) },
    )
    return unsub
  }, [group?.id])

  return { recurringExpenses, loading }
}

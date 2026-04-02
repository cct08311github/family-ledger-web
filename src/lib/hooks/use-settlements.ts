'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Settlement } from '@/lib/types'

import { logger } from '@/lib/logger'

export function useSettlements(groupId: string | undefined) {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) {
      setLoading(false)
      return
    }
    // Path: groups/{groupId}/settlements
    const q = query(collection(db, 'groups', groupId, 'settlements'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => {
        setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Settlement))
        setLoading(false)
      },
      (err) => {
        logger.error('[useSettlements] Snapshot error:', err)
        setLoading(false)
      },
    )
    return unsub
  }, [groupId])

  return { settlements, loading }
}

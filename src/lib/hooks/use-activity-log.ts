'use client'

import { useState, useEffect } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ActivityLog } from '@/lib/types'

import { logger } from '@/lib/logger'

export function useActivityLog(groupId: string | undefined, max = 50) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const q = query(
      collection(db, 'groups', groupId, 'activityLogs'),
      orderBy('createdAt', 'desc'),
      limit(max),
    )
    const unsub = onSnapshot(q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)))
        setLoading(false)
      },
      (err) => {
        logger.error('[useActivityLog] Snapshot error:', err)
        setLoading(false)
      },
    )
    return unsub
  }, [groupId, max])

  return { logs, loading }
}

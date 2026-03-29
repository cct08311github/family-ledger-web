'use client'

import { useState, useEffect } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ActivityLog } from '@/lib/types'

export function useActivityLog(groupId: string | undefined, max = 50) {
  const [logs, setLogs] = useState<ActivityLog[]>([])

  useEffect(() => {
    if (!groupId) return
    const q = query(
      collection(db, 'groups', groupId, 'activityLogs'),
      orderBy('createdAt', 'desc'),
      limit(max),
    )
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)))
    })
    return unsub
  }, [groupId, max])

  return logs
}

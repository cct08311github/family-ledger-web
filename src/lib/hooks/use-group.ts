'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth'
import type { FamilyGroup } from '@/lib/types'

import { logger } from '@/lib/logger'

/** 取得目前使用者的主要群組 */
export function useGroup() {
  const { user } = useAuth()
  const [group, setGroup] = useState<FamilyGroup | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'groups'),
      where('memberUids', 'array-contains', user.uid),
    )
    const unsub = onSnapshot(q,
      (snap) => {
        const groups = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyGroup)
        setGroup(groups.find((g) => g.isPrimary) ?? groups[0] ?? null)
        setLoading(false)
      },
      (err) => {
        logger.error('[useGroup] Snapshot error:', err)
        setLoading(false)
      },
    )
    return unsub
  }, [user])

  return { group, loading }
}

'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { FamilyMember } from '@/lib/types'

import { logger } from '@/lib/logger'

export function useMembers(groupId: string | undefined) {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const q = query(collection(db, 'groups', groupId, 'members'), orderBy('sortOrder'))
    const unsub = onSnapshot(q,
      (snap) => {
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember))
        setLoading(false)
      },
      (err) => {
        logger.error('[useMembers] Snapshot error:', err)
        setLoading(false)
      },
    )
    return unsub
  }, [groupId])

  return { members, loading }
}

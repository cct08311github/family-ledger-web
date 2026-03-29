'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { FamilyMember } from '@/lib/types'

export function useMembers(groupId: string | undefined) {
  const [members, setMembers] = useState<FamilyMember[]>([])

  useEffect(() => {
    if (!groupId) return
    const q = query(collection(db, 'groups', groupId, 'members'), orderBy('sortOrder'))
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember))
    })
    return unsub
  }, [groupId])

  return members
}

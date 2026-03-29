'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Settlement } from '@/lib/types'

export function useSettlements(groupId: string | undefined) {
  const [settlements, setSettlements] = useState<Settlement[]>([])

  useEffect(() => {
    if (!groupId) return
    const q = query(collection(db, 'groups', groupId, 'settlements'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Settlement))
    })
    return unsub
  }, [groupId])

  return settlements
}

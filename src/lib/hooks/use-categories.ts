'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Category } from '@/lib/types'

export function useCategories(groupId: string | undefined) {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    if (!groupId) return
    const q = query(
      collection(db, 'groups', groupId, 'categories'),
      orderBy('sortOrder'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category)))
    })
    return unsub
  }, [groupId])

  return categories
}

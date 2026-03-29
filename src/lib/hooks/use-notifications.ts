'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AppNotification } from '@/lib/types'

export function useNotifications(groupId: string | undefined, recipientId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!groupId || !recipientId) return

    const q = query(
      collection(db, 'groups', groupId, 'notifications'),
      where('recipientId', '==', recipientId),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification))
        setNotifications(notifs)
        setUnreadCount(notifs.filter((n) => !n.isRead).length)
      },
      (err) => {
        // Likely a missing composite index (recipientId + createdAt).
        // Deploy: firebase deploy --only firestore:indexes
        console.error('[useNotifications] Firestore query failed:', err.message)
      },
    )

    return unsub
  }, [groupId, recipientId])

  return { notifications, unreadCount }
}

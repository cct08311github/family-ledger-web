import { addDoc, collection, updateDoc, doc, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'

import { logger } from '@/lib/logger'

export interface NotificationInput {
  type: string
  title: string
  body: string
  recipientId: string
  entityId?: string
}

export async function addNotification(groupId: string, input: NotificationInput): Promise<string> {
  const ref = await addDoc(collection(db, 'groups', groupId, 'notifications'), {
    groupId,
    type: input.type,
    title: input.title,
    body: input.body,
    entityId: input.entityId ?? null,
    recipientId: input.recipientId,
    isRead: false,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function markNotificationRead(groupId: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId, 'notifications', notificationId), {
    isRead: true,
  })
}

export async function markAllNotificationsRead(groupId: string, recipientId: string): Promise<void> {
  const q = query(
    collection(db, 'groups', groupId, 'notifications'),
    where('recipientId', '==', recipientId),
    where('isRead', '==', false)
  )
  const snap = await getDocs(q)
  if (snap.empty) return

  // Firestore batches have a 500-op limit; chunk to stay safely under it
  const BATCH_LIMIT = 499
  try {
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db)
      const chunk = snap.docs.slice(i, i + BATCH_LIMIT)
      chunk.forEach((d) => batch.update(d.ref, { isRead: true }))
      await batch.commit()
    }
  } catch (err) {
    logger.error('[notification-service] markAllNotificationsRead failed:', err)
    throw err
  }
}

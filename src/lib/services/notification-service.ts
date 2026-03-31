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

  // Use writeBatch (max 500 ops) for atomic, efficient bulk update
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }))
  try {
    await batch.commit()
  } catch (err) {
    logger.error('[notification-service] markAllNotificationsRead failed:', err)
    throw err
  }
}

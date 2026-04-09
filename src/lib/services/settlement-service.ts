import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { addActivityLog } from './activity-log-service'
import { addNotification } from './notification-service'
import { currency } from '@/lib/utils'

import { logger } from '@/lib/logger'

export interface NewSettlement {
  fromMemberId: string
  fromMemberName: string
  toMemberId: string
  toMemberName: string
  amount: number
  note?: string
  date: Date
}

interface Actor {
  id: string
  name: string
}

export async function addSettlement(groupId: string, data: NewSettlement, actor?: Actor): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')

  const ref = await addDoc(collection(db, 'groups', groupId, 'settlements'), {
    groupId,
    fromMemberId: data.fromMemberId,
    fromMemberName: data.fromMemberName,
    toMemberId: data.toMemberId,
    toMemberName: data.toMemberName,
    amount: data.amount,
    note: data.note ?? null,
    date: Timestamp.fromDate(data.date),
    createdAt: serverTimestamp(),
    createdBy: uid,
  })
  if (actor) {
    try {
      await addActivityLog(groupId, {
        action: 'settlement_created',
        actorId: actor.id,
        actorName: actor.name,
        description: `記錄結算：${data.fromMemberName} → ${data.toMemberName} ${currency(data.amount)}`,
        entityId: ref.id,
      })
    } catch (e) {
      logger.error('[SettlementService] Failed to log activity:', e)
    }
  }
  // Notify other group members about the settlement
  try {
    const groupSnap = await getDoc(doc(db, 'groups', groupId))
    const memberUids: string[] = groupSnap.data()?.memberUids ?? []
    const currentUid = auth.currentUser?.uid
    for (const uid of memberUids) {
      if (uid !== currentUid) {
        await addNotification(groupId, {
          type: 'settlement_created',
          title: '新增結算',
          body: `${data.fromMemberName} → ${data.toMemberName}（${currency(data.amount)}）`,
          recipientId: uid,
          entityId: ref.id,
        })
      }
    }
  } catch (e) {
    logger.error('[SettlementService] Failed to send notifications:', e)
  }

  return ref.id
}

export async function addSettlements(
  groupId: string,
  settlements: Array<{ fromMemberId: string; toMemberId: string; fromMemberName: string; toMemberName: string; amount: number }>,
  actor?: Actor,
): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')

  const batch = writeBatch(db)
  const today = Timestamp.fromDate(new Date())

  for (const s of settlements) {
    const ref = doc(collection(db, 'groups', groupId, 'settlements'))
    batch.set(ref, {
      groupId,
      fromMemberId: s.fromMemberId,
      toMemberId: s.toMemberId,
      fromMemberName: s.fromMemberName,
      toMemberName: s.toMemberName,
      amount: s.amount,
      note: '批次結清',
      date: today,
      createdAt: serverTimestamp(),
      createdBy: uid,
    })
  }

  await batch.commit()

  if (actor) {
    try {
      for (const s of settlements) {
        await addActivityLog(groupId, {
          action: 'settlement_created',
          actorId: actor.id,
          actorName: actor.name,
          description: `批次結清：${s.fromMemberName} → ${s.toMemberName} ${currency(s.amount)}`,
          entityId: '',
        })
      }
    } catch (e) {
      logger.error('[SettlementService] Failed to log batch activity:', e)
    }
  }
}

export async function deleteSettlement(groupId: string, settlementId: string, actor?: Actor): Promise<void> {
  if (!auth.currentUser?.uid) throw new Error('Not authenticated')

  await deleteDoc(doc(db, 'groups', groupId, 'settlements', settlementId))
  if (actor) {
    try {
      await addActivityLog(groupId, {
        action: 'settlement_deleted',
        actorId: actor.id,
        actorName: actor.name,
        description: `刪除結算記錄`,
        entityId: settlementId,
      })
    } catch (e) {
      logger.error('[SettlementService] Failed to log activity:', e)
    }
  }
}

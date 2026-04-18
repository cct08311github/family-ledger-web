import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { addActivityLog } from './activity-log-service'
import { addNotification } from './notification-service'
import { notifyByEmailFanOut } from './email-notification'
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
  // Notify other group members about the settlement (in-app + email).
  try {
    const groupSnap = await getDoc(doc(db, 'groups', groupId))
    const groupData = groupSnap.data()
    const memberUids: string[] = groupData?.memberUids ?? []
    const groupName = groupData?.name as string | undefined
    const currentUid = auth.currentUser?.uid
    const recipients = memberUids.filter((uid) => uid !== currentUid)
    const title = '新增結算'
    const body = `${data.fromMemberName} → ${data.toMemberName}（${currency(data.amount)}）`
    await Promise.all(
      recipients.map((uid) =>
        addNotification(groupId, { type: 'settlement_created', title, body, recipientId: uid, entityId: ref.id }),
      ),
    )
    await notifyByEmailFanOut({ groupId, recipientUids: recipients, title, body, groupName })
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
  if (settlements.length > 50) throw new Error('Cannot settle more than 50 debts at once')

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

  // Notify other group members about the batch settlement (in-app + email).
  try {
    const groupSnap = await getDoc(doc(db, 'groups', groupId))
    const groupData = groupSnap.data()
    const memberUids: string[] = groupData?.memberUids ?? []
    const groupName = groupData?.name as string | undefined
    const recipients = memberUids.filter((u) => u !== uid)
    const title = '批次結清'
    const body = `已結清 ${settlements.length} 筆債務`
    await Promise.all(
      recipients.map((u) =>
        addNotification(groupId, { type: 'settlement_created', title, body, recipientId: u }),
      ),
    )
    await notifyByEmailFanOut({ groupId, recipientUids: recipients, title, body, groupName })
  } catch (e) {
    logger.error('[SettlementService] Failed to send batch notifications:', e)
  }
}

export async function deleteSettlement(groupId: string, settlementId: string, actor?: Actor): Promise<void> {
  if (!auth.currentUser?.uid) throw new Error('Not authenticated')

  // Read pre-delete snapshot for notification context (who settled whom for how much).
  // Best-effort: if the read fails we still delete but the notification body degrades.
  // Issue #187.
  let settlementDesc = '此筆結算紀錄'
  try {
    const snap = await getDoc(doc(db, 'groups', groupId, 'settlements', settlementId))
    if (snap.exists()) {
      const d = snap.data() as {
        fromMemberName?: string
        toMemberName?: string
        amount?: number
      }
      if (d.fromMemberName && d.toMemberName && typeof d.amount === 'number') {
        settlementDesc = `${d.fromMemberName} → ${d.toMemberName}（${currency(d.amount)}）`
      }
    }
  } catch (e) {
    logger.error('[SettlementService] Failed to read pre-delete snapshot:', e)
  }

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

  // Notify other group members about the deletion (in-app + email).
  // Issue #187.
  try {
    const groupSnap = await getDoc(doc(db, 'groups', groupId))
    const groupData = groupSnap.data()
    const memberUids: string[] = groupData?.memberUids ?? []
    const groupName = groupData?.name as string | undefined
    const currentUid = auth.currentUser?.uid
    const recipients = memberUids.filter((uid) => uid !== currentUid)
    const title = '刪除結算'
    const body = `${actor?.name ?? '成員'}刪除了結算：${settlementDesc}`
    await Promise.all(
      recipients.map((uid) =>
        addNotification(groupId, { type: 'settlement_deleted', title, body, recipientId: uid, entityId: settlementId }),
      ),
    )
    await notifyByEmailFanOut({ groupId, recipientUids: recipients, title, body, groupName })
  } catch (e) {
    logger.error('[SettlementService] Failed to send delete notifications:', e)
  }
}

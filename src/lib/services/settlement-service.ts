import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { addActivityLog } from './activity-log-service'
import { currency } from '@/lib/utils'

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
  })
  if (actor) {
    await addActivityLog(groupId, {
      action: 'settlement_created',
      actorId: actor.id,
      actorName: actor.name,
      description: `記錄結算：${data.fromMemberName} → ${data.toMemberName} ${currency(data.amount)}`,
      entityId: ref.id,
    })
  }
  return ref.id
}

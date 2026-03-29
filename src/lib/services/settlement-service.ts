import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface NewSettlement {
  fromMemberId: string
  fromMemberName: string
  toMemberId: string
  toMemberName: string
  amount: number
  note?: string
  date: Date
}

export async function addSettlement(groupId: string, data: NewSettlement): Promise<void> {
  await addDoc(collection(db, 'groups', groupId, 'settlements'), {
    fromMemberId: data.fromMemberId,
    fromMemberName: data.fromMemberName,
    toMemberId: data.toMemberId,
    toMemberName: data.toMemberName,
    amount: data.amount,
    note: data.note ?? null,
    date: Timestamp.fromDate(data.date),
    createdAt: serverTimestamp(),
  })
}

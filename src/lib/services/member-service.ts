import { addDoc, collection, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { MemberRole } from '@/lib/types'

export async function addMember(groupId: string, name: string, role: MemberRole = 'member'): Promise<string> {
  const ref = await addDoc(collection(db, 'groups', groupId, 'members'), {
    groupId,
    name,
    role,
    sortOrder: Date.now(),
    isCurrentUser: false,
    createdAt: Timestamp.now(),
  })
  return ref.id
}

export async function removeMember(groupId: string, memberId: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'members', memberId))
}

export async function updateMember(
  groupId: string,
  memberId: string,
  data: { name?: string; role?: MemberRole; isCurrentUser?: boolean },
): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId, 'members', memberId), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

import { addDoc, collection, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { addActivityLog } from './activity-log-service'
import type { MemberRole } from '@/lib/types'

interface Actor {
  id: string
  name: string
}

export async function addMember(groupId: string, name: string, role: MemberRole = 'member', actor?: Actor): Promise<string> {
  const ref = await addDoc(collection(db, 'groups', groupId, 'members'), {
    groupId,
    name,
    role,
    sortOrder: Date.now(),
    isCurrentUser: false,
    createdAt: Timestamp.now(),
  })
  if (actor) {
    await addActivityLog(groupId, {
      action: 'member_added',
      actorId: actor.id,
      actorName: actor.name,
      description: `新增成員：${name}`,
      entityId: ref.id,
    })
  }
  return ref.id
}

export async function removeMember(groupId: string, memberId: string, actor?: Actor, removedMemberName?: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'members', memberId))
  if (actor) {
    await addActivityLog(groupId, {
      action: 'member_removed',
      actorId: actor.id,
      actorName: actor.name,
      description: `移除成員：${removedMemberName ?? memberId}`,
      entityId: memberId,
    })
  }
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

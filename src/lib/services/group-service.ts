import { addDoc, collection, doc, updateDoc, deleteDoc, getDocs, Timestamp, arrayRemove } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'

export async function createGroup(name: string, isFirst = false): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')
  const trimmed = name.trim()
  if (!trimmed) throw new Error('群組名稱不能為空')
  if (trimmed.length > 50) throw new Error('群組名稱最長 50 字')

  const ref = await addDoc(collection(db, 'groups'), {
    name: trimmed,
    isPrimary: isFirst,
    ownerUid: user.uid,
    memberUids: [user.uid],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return ref.id
}

export async function updateGroup(groupId: string, data: { name?: string; isPrimary?: boolean }): Promise<void> {
  const ref = doc(db, 'groups', groupId)
  await updateDoc(ref, { ...data, updatedAt: Timestamp.now() })
}

export async function deleteGroup(groupId: string): Promise<void> {
  // Delete subcollections first
  for (const sub of ['expenses', 'settlements', 'members', 'categories', 'activityLogs', 'notifications']) {
    const snap = await getDocs(collection(db, 'groups', groupId, sub))
    for (const d of snap.docs) {
      await deleteDoc(d.ref)
    }
  }
  await deleteDoc(doc(db, 'groups', groupId))
}

export async function leaveGroup(groupId: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')
  const ref = doc(db, 'groups', groupId)
  await updateDoc(ref, {
    memberUids: arrayRemove(user.uid),
    updatedAt: Timestamp.now(),
  })
}

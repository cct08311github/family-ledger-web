import { addDoc, collection, doc, updateDoc, deleteDoc, getDocs, Timestamp, arrayRemove } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'

const DEFAULT_CATEGORIES = [
  { name: '餐飲', icon: '🍜' },
  { name: '交通', icon: '🚌' },
  { name: '日用品', icon: '🛒' },
  { name: '房租', icon: '🏠' },
  { name: '水電', icon: '💡' },
  { name: '醫療', icon: '🏥' },
  { name: '娛樂', icon: '🎮' },
  { name: '教育', icon: '📚' },
  { name: '家庭', icon: '👨‍👩‍👧' },
  { name: '旅遊', icon: '✈️' },
]

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

  // Seed default categories
  const catCol = collection(db, 'groups', ref.id, 'categories')
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const c = DEFAULT_CATEGORIES[i]
    await addDoc(catCol, {
      groupId: ref.id,
      name: c.name,
      icon: c.icon,
      sortOrder: i,
      isDefault: true,
      isActive: true,
      createdAt: Timestamp.now(),
    })
  }

  return ref.id
}

export async function updateGroup(groupId: string, data: { name?: string; isPrimary?: boolean }): Promise<void> {
  const ref = doc(db, 'groups', groupId)
  await updateDoc(ref, { ...data, updatedAt: Timestamp.now() })
}

export async function deleteGroup(groupId: string): Promise<void> {
  // Delete subcollections that security rules allow owner to delete
  for (const sub of ['members', 'categories', 'expenses', 'settlements', 'notifications']) {
    try {
      const snap = await getDocs(collection(db, 'groups', groupId, sub))
      for (const d of snap.docs) {
        try { await deleteDoc(d.ref) } catch { /* skip docs we can't delete */ }
      }
    } catch { /* skip subcollections we can't read/delete */ }
  }
  // activityLogs are immutable (delete: false in rules), left as orphans
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

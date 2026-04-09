import { addDoc, collection, doc, updateDoc, getDocs, getDoc, query, where, Timestamp, arrayRemove, arrayUnion, writeBatch } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

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
  { name: '飲料', icon: '☕' },
  { name: '美妝', icon: '🧴' },
  { name: '通訊', icon: '📱' },
  { name: '運動', icon: '🏋️' },
  { name: '寵物', icon: '🐾' },
  { name: '禮物', icon: '🎁' },
  { name: '汽車', icon: '🚗' },
  { name: '服飾', icon: '👕' },
  { name: '保險', icon: '💰' },
  { name: '維修', icon: '🔧' },
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

  // Seed default categories (single batch write)
  const batch = writeBatch(db)
  const catCol = collection(db, 'groups', ref.id, 'categories')
  const now = Timestamp.now()
  DEFAULT_CATEGORIES.forEach((c, i) => {
    const catRef = doc(catCol)
    batch.set(catRef, {
      groupId: ref.id,
      name: c.name,
      icon: c.icon,
      sortOrder: i,
      isDefault: true,
      isActive: true,
      createdAt: now,
    })
  })
  await batch.commit()

  return ref.id
}

export async function updateGroup(
  groupId: string,
  data: { name?: string; isPrimary?: boolean; monthlyBudget?: number | null },
): Promise<void> {
  const ref = doc(db, 'groups', groupId)
  await updateDoc(ref, { ...data, updatedAt: Timestamp.now() })
}

export async function deleteGroup(groupId: string): Promise<void> {
  const BATCH_LIMIT = 500
  // Note: activityLogs intentionally excluded — Firestore rules forbid client-side deletion
  const subcollections = ['members', 'categories', 'expenses', 'settlements', 'notifications', 'userPreferences']

  // Collect all refs to delete
  const allRefs: import('firebase/firestore').DocumentReference[] = []
  for (const sub of subcollections) {
    try {
      const snap = await getDocs(collection(db, 'groups', groupId, sub))
      snap.docs.forEach((d) => allRefs.push(d.ref))
    } catch { /* skip subcollections we can't read (e.g. activityLogs with delete:false) */ }
  }
  allRefs.push(doc(db, 'groups', groupId))

  // Chunk into batches of up to BATCH_LIMIT operations
  for (let i = 0; i < allRefs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    allRefs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

export async function refreshInviteCode(groupId: string): Promise<string> {
  const code = generateInviteCode()
  await updateDoc(doc(db, 'groups', groupId), {
    inviteCode: code,
    updatedAt: Timestamp.now(),
  })
  return code
}

export async function joinGroupByInviteCode(code: string): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('請先登入')
  const trimmed = code.trim().toUpperCase()
  if (!trimmed || trimmed.length !== 6) throw new Error('請輸入 6 位邀請碼')

  const q = query(collection(db, 'groups'), where('inviteCode', '==', trimmed))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('邀請碼無效或已過期')

  const groupDoc = snap.docs[0]
  const data = groupDoc.data()
  if ((data.memberUids as string[]).includes(user.uid)) {
    throw new Error('你已經在這個群組中')
  }

  await updateDoc(groupDoc.ref, {
    memberUids: arrayUnion(user.uid),
    updatedAt: Timestamp.now(),
  })
  return groupDoc.id
}

/** Seed missing default categories for an existing group (skips already existing names). */
export async function seedMissingCategories(groupId: string): Promise<number> {
  const catCol = collection(db, 'groups', groupId, 'categories')
  const snap = await getDocs(catCol)
  const existingNames = new Set(snap.docs.map((d) => d.data().name as string))

  const missing = DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name))
  if (missing.length === 0) return 0

  const batch = writeBatch(db)
  const now = Timestamp.now()
  const startOrder = snap.size
  missing.forEach((c, i) => {
    batch.set(doc(catCol), {
      groupId,
      name: c.name,
      icon: c.icon,
      sortOrder: startOrder + i,
      isDefault: true,
      isActive: true,
      createdAt: now,
    })
  })
  await batch.commit()
  return missing.length
}

export async function leaveGroup(groupId: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')
  const snap = await getDoc(doc(db, 'groups', groupId))
  if (!snap.exists()) {
    throw new Error('Group not found')
  }
  const data = snap.data()
  if (data.ownerUid === user.uid) {
    throw new Error('群組擁有者不能離開群組，請先轉移擁有權或刪除群組')
  }
  await updateDoc(snap.ref, {
    memberUids: arrayRemove(user.uid),
    updatedAt: Timestamp.now(),
  })
}

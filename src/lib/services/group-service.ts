import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'

export async function createGroup(name: string): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')
  const trimmed = name.trim()
  if (!trimmed) throw new Error('群組名稱不能為空')
  if (trimmed.length > 50) throw new Error('群組名稱最長 50 字')

  const ref = await addDoc(collection(db, 'groups'), {
    name: trimmed,
    isPrimary: true,
    ownerUid: user.uid,
    memberUids: [user.uid],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return ref.id
}

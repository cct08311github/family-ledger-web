import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'

export async function createGroup(name: string): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')

  const ref = await addDoc(collection(db, 'groups'), {
    name,
    isPrimary: true,
    ownerUid: user.uid,
    memberUids: [user.uid],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return ref.id
}

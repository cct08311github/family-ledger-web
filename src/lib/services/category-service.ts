import { addDoc, collection, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface CategoryInput {
  name: string
  icon: string
  sortOrder: number
  isDefault?: boolean
  isActive?: boolean
}

export async function addCategory(groupId: string, input: CategoryInput): Promise<string> {
  const ref = await addDoc(collection(db, 'groups', groupId, 'categories'), {
    groupId,
    ...input,
    isDefault: input.isDefault ?? false,
    isActive: input.isActive ?? true,
    createdAt: Timestamp.now(),
  })
  return ref.id
}

export async function updateCategory(
  groupId: string,
  categoryId: string,
  input: Partial<CategoryInput>,
): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId, 'categories', categoryId), {
    ...input,
    updatedAt: Timestamp.now(),
  })
}

export async function deleteCategory(groupId: string, categoryId: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'categories', categoryId))
}

export async function reorderCategories(
  groupId: string,
  orderedIds: string[],
): Promise<void> {
  const batch = orderedIds.map((id, index) =>
    updateDoc(doc(db, 'groups', groupId, 'categories', id), { sortOrder: index }),
  )
  await Promise.all(batch)
}

import { addDoc, collection, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { addActivityLog } from './activity-log-service'

export interface CategoryInput {
  name: string
  icon: string
  sortOrder: number
  isDefault?: boolean
  isActive?: boolean
}

interface Actor {
  id: string
  name: string
}

export async function addCategory(groupId: string, input: CategoryInput, actor?: Actor): Promise<string> {
  const ref = await addDoc(collection(db, 'groups', groupId, 'categories'), {
    groupId,
    ...input,
    isDefault: input.isDefault ?? false,
    isActive: input.isActive ?? true,
    createdAt: Timestamp.now(),
  })
  if (actor) {
    await addActivityLog(groupId, {
      action: 'category_created',
      actorId: actor.id,
      actorName: actor.name,
      description: `新增類別：${input.name}`,
      entityId: ref.id,
    })
  }
  return ref.id
}

export async function updateCategory(
  groupId: string,
  categoryId: string,
  input: Partial<CategoryInput>,
  actor?: Actor,
): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId, 'categories', categoryId), {
    ...input,
    updatedAt: Timestamp.now(),
  })
  if (actor) {
    await addActivityLog(groupId, {
      action: 'category_updated',
      actorId: actor.id,
      actorName: actor.name,
      description: `編輯類別：${input.name ?? ''}`,
      entityId: categoryId,
    })
  }
}

export async function deleteCategory(groupId: string, categoryId: string, actor?: Actor, categoryName?: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'categories', categoryId))
  if (actor) {
    await addActivityLog(groupId, {
      action: 'category_deleted',
      actorId: actor.id,
      actorName: actor.name,
      description: `刪除類別：${categoryName ?? categoryId}`,
      entityId: categoryId,
    })
  }
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

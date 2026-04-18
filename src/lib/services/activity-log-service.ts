import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { truncateActivityDescription } from '@/lib/activity-description-limit'

export { MAX_ACTIVITY_LOG_DESCRIPTION_LENGTH, truncateActivityDescription } from '@/lib/activity-description-limit'

export type LogAction =
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_created'
  | 'settlement_deleted'
  | 'member_added'
  | 'member_updated'
  | 'member_removed'
  | 'category_created'
  | 'category_updated'
  | 'category_deleted'

const ACTION_LABELS: Record<LogAction, string> = {
  expense_created: '新增支出',
  expense_updated: '編輯支出',
  expense_deleted: '刪除支出',
  settlement_created: '記錄結算',
  settlement_deleted: '刪除結算',
  member_added: '新增成員',
  member_updated: '編輯成員',
  member_removed: '移除成員',
  category_created: '新增類別',
  category_updated: '編輯類別',
  category_deleted: '刪除類別',
}

export interface LogInput {
  action: LogAction
  actorName: string
  actorId: string
  description: string
  entityId?: string
}

export async function addActivityLog(groupId: string, input: LogInput): Promise<void> {
  const rawDesc = input.description || (ACTION_LABELS[input.action] ?? input.action)
  const description = truncateActivityDescription(rawDesc)
  await addDoc(collection(db, 'groups', groupId, 'activityLogs'), {
    groupId,
    action: input.action,
    actorName: input.actorName,
    actorId: input.actorId,
    description,
    entityId: input.entityId ?? null,
    createdAt: serverTimestamp(),
  })
}

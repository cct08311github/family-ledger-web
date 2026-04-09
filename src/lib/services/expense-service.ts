import { collection, doc, setDoc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { addActivityLog } from './activity-log-service'
import { addNotification } from './notification-service'
import { currency } from '@/lib/utils'
import type { SplitDetail, SplitMethod, PaymentMethod } from '@/lib/types'

import { logger } from '@/lib/logger'

interface Actor {
  id: string
  name: string
}

function genId(): string {
  return crypto.randomUUID()
}

export interface ExpenseInput {
  date: Date
  description: string
  amount: number
  category: string
  isShared: boolean
  splitMethod: SplitMethod
  payerId: string
  payerName: string
  splits: SplitDetail[]
  paymentMethod: PaymentMethod
  receiptPaths: string[]
  note?: string
  createdBy: string
}

export async function addExpense(groupId: string, input: ExpenseInput, actor?: Actor): Promise<string> {
  const id = genId()
  const now = Timestamp.now()
  const ref = doc(collection(db, 'groups', groupId, 'expenses'), id)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { receiptPaths: _receiptPaths, note, ...rest } = input
  await setDoc(ref, {
    ...rest,
    date: Timestamp.fromDate(input.date),
    receiptPath: input.receiptPaths[0] ?? null,
    ...(note !== undefined ? { note } : {}),
    createdAt: now,
    updatedAt: now,
  })
  if (actor) {
    try {
      await addActivityLog(groupId, {
        action: 'expense_created',
        actorId: actor.id,
        actorName: actor.name,
        description: `新增支出：${input.description}`,
        entityId: id,
      })
    } catch (e) {
      logger.error('[ExpenseService] Failed to log activity:', e)
    }
  }
  // Notify other group members about shared expenses
  if (input.isShared) {
    try {
      const groupSnap = await getDoc(doc(db, 'groups', groupId))
      const memberUids: string[] = groupSnap.data()?.memberUids ?? []
      const currentUid = auth.currentUser?.uid
      await Promise.all(
        memberUids
          .filter((uid) => uid !== currentUid)
          .map((uid) =>
            addNotification(groupId, {
              type: 'expense_added',
              title: '新增共同支出',
              body: `${actor?.name ?? '成員'}新增了 ${input.description}（${currency(input.amount)}）`,
              recipientId: uid,
              entityId: id,
            }),
          ),
      )
    } catch (e) {
      logger.error('[ExpenseService] Failed to send notifications:', e)
    }
  }

  return id
}

export async function updateExpense(groupId: string, expenseId: string, input: Partial<ExpenseInput>, actor?: Actor): Promise<void> {
  const ref = doc(db, 'groups', groupId, 'expenses', expenseId)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { receiptPaths: _rp, note, ...rest } = input
  const data: Record<string, unknown> = { ...rest, updatedAt: Timestamp.now() }
  if (note !== undefined) data.note = note
  if (input.date) data.date = Timestamp.fromDate(input.date)
  if (input.receiptPaths) data.receiptPath = input.receiptPaths[0] ?? null
  await setDoc(ref, data, { merge: true })
  if (actor) {
    try {
      await addActivityLog(groupId, {
        action: 'expense_updated',
        actorId: actor.id,
        actorName: actor.name,
        description: `編輯支出：${input.description ?? ''}`,
        entityId: expenseId,
      })
    } catch (e) {
      logger.error('[ExpenseService] Failed to log activity:', e)
    }
  }
}

export async function deleteExpense(groupId: string, expenseId: string, actor?: Actor): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'expenses', expenseId))
  if (actor) {
    try {
      await addActivityLog(groupId, {
        action: 'expense_deleted',
        actorId: actor.id,
        actorName: actor.name,
        description: `刪除支出`,
        entityId: expenseId,
      })
    } catch (e) {
      logger.error('[ExpenseService] Failed to log activity:', e)
    }
  }
}

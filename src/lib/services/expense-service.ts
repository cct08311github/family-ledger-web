import { collection, doc, setDoc, deleteDoc, Timestamp, getDoc, getDocs, query, orderBy, limit, startAfter, DocumentSnapshot, serverTimestamp, deleteField } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { addActivityLog } from './activity-log-service'
import { addNotification } from './notification-service'
import { deleteReceiptImages, normalizeReceiptPaths } from './image-upload'
import { currency } from '@/lib/utils'
import type { Expense, SplitDetail, SplitMethod, PaymentMethod } from '@/lib/types'

import { logger } from '@/lib/logger'

interface Actor {
  id: string
  name: string
}

export function genExpenseId(): string {
  return crypto.randomUUID()
}

// Backwards-compat alias for internal callers.
const genId = genExpenseId

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

export async function addExpense(
  groupId: string,
  input: ExpenseInput,
  actor?: Actor,
  preGeneratedId?: string,
): Promise<string> {
  const id = preGeneratedId ?? genId()
  const ref = doc(collection(db, 'groups', groupId, 'expenses'), id)
  const { receiptPaths, note, ...rest } = input
  await setDoc(ref, {
    ...rest,
    date: Timestamp.fromDate(input.date),
    receiptPaths: receiptPaths ?? [],
    ...(note !== undefined ? { note } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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
  const { receiptPaths, note, ...rest } = input
  const data: Record<string, unknown> = { ...rest, updatedAt: serverTimestamp() }
  if (note !== undefined) data.note = note
  if (input.date) data.date = Timestamp.fromDate(input.date)
  if (receiptPaths !== undefined) {
    data.receiptPaths = receiptPaths
    // Clear legacy single-receipt field once we start writing the array form.
    data.receiptPath = deleteField()
  }
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

export const LOAD_MORE_PAGE_SIZE = 50

export interface LoadMoreResult {
  expenses: Expense[]
  hasMore: boolean
  lastDoc: DocumentSnapshot | null
}

/**
 * Fetches the next batch of expenses after the given cursor document.
 * Used for cursor-based pagination beyond the initial real-time subscription (limit 200).
 */
export async function loadMoreExpenses(groupId: string, afterDoc: DocumentSnapshot): Promise<LoadMoreResult> {
  if (afterDoc.ref.parent.parent?.id !== groupId) {
    throw new Error('Cursor document does not belong to the specified group')
  }
  const q = query(
    collection(db, 'groups', groupId, 'expenses'),
    orderBy('date', 'desc'),
    startAfter(afterDoc),
    limit(LOAD_MORE_PAGE_SIZE),
  )
  const snap = await getDocs(q)
  const expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
  return {
    expenses,
    hasMore: snap.docs.length === LOAD_MORE_PAGE_SIZE,
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
  }
}

export async function deleteExpense(groupId: string, expenseId: string, actor?: Actor): Promise<void> {
  const ref = doc(db, 'groups', groupId, 'expenses', expenseId)
  try {
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const paths = normalizeReceiptPaths(snap.data() as { receiptPaths?: string[]; receiptPath?: string | null })
      if (paths.length > 0) await deleteReceiptImages(paths)
    }
  } catch (e) {
    logger.error('[ExpenseService] Failed to delete receipt images:', e)
  }
  await deleteDoc(ref)
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

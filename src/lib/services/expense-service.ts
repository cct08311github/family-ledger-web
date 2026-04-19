import { collection, doc, setDoc, deleteDoc, Timestamp, getDoc, getDocs, query, orderBy, limit, startAfter, DocumentSnapshot, serverTimestamp, deleteField } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { addActivityLog } from './activity-log-service'
import { addNotification } from './notification-service'
import { notifyByEmailFanOut } from './email-notification'
import type { EmailDetails } from './email-notification'
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

/**
 * Fan out an expense notification to all group members except the actor.
 * Swallows errors — notifications are non-critical and should not block writes.
 */
async function notifyMembersAboutExpense(
  groupId: string,
  payload: { type: string; title: string; body: string; entityId: string; details?: EmailDetails },
): Promise<void> {
  try {
    const groupSnap = await getDoc(doc(db, 'groups', groupId))
    const groupData = groupSnap.data()
    const memberUids: string[] = groupData?.memberUids ?? []
    const groupName = groupData?.name as string | undefined
    const currentUid = auth.currentUser?.uid
    const recipients = memberUids.filter((uid) => uid !== currentUid)
    // In-app notifications (primary, sync).
    await Promise.all(
      recipients.map((uid) => addNotification(groupId, { ...payload, recipientId: uid })),
    )
    // Email notifications (best-effort, Issue #187) — gated by each recipient's
    // per-group opt-in preference.
    await notifyByEmailFanOut({
      groupId,
      recipientUids: recipients,
      title: payload.title,
      body: payload.body,
      groupName,
      details: payload.details,
    })
  } catch (e) {
    logger.error('[ExpenseService] Failed to send notifications:', e)
  }
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
    await notifyMembersAboutExpense(groupId, {
      type: 'expense_added',
      title: '新增共同支出',
      body: `${actor?.name ?? '成員'}新增了 ${input.description}（${currency(input.amount)}）`,
      entityId: id,
      details: {
        kind: 'expense',
        date: input.date,
        description: input.description,
        amount: input.amount,
        isShared: input.isShared,
        category: input.category,
        payerName: input.payerName,
        splits: input.splits
          .filter((s) => s.isParticipant && s.shareAmount > 0)
          .map((s) => ({ name: s.memberName, share: s.shareAmount })),
        note: input.note,
        entityId: id,
      },
    })
  }

  return id
}

export async function updateExpense(groupId: string, expenseId: string, input: Partial<ExpenseInput>, actor?: Actor): Promise<void> {
  const ref = doc(db, 'groups', groupId, 'expenses', expenseId)

  // Read the previous state so we can notify when either old or new was shared.
  let prevShared = false
  let prevDescription = ''
  let prevAmount = 0
  let prevDate: Date | undefined
  let prevPayerName: string | undefined
  let prevCategory: string | undefined
  let prevSplits: Array<{ name: string; share: number }> | undefined
  try {
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const d = snap.data() as {
        isShared?: boolean
        description?: string
        amount?: number
        date?: { toDate(): Date }
        payerName?: string
        category?: string
        splits?: Array<{ memberName?: string; shareAmount?: number; isParticipant?: boolean }>
      }
      prevShared = !!d.isShared
      prevDescription = d.description ?? ''
      prevAmount = d.amount ?? 0
      prevDate = d.date ? d.date.toDate() : undefined
      prevPayerName = d.payerName
      prevCategory = d.category
      if (d.splits) {
        prevSplits = d.splits
          .filter((s) => s.isParticipant && (s.shareAmount ?? 0) > 0)
          .map((s) => ({ name: s.memberName ?? '', share: s.shareAmount ?? 0 }))
      }
    }
  } catch (e) {
    logger.error('[ExpenseService] Failed to read pre-update snapshot:', e)
  }

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

  // Notify if the expense was shared before OR is shared now.
  // input.isShared may be undefined in a partial update — fall back to prevShared.
  const nowShared = input.isShared ?? prevShared
  if (prevShared || nowShared) {
    const description = input.description ?? prevDescription
    const amount = input.amount ?? prevAmount
    const notifyDate = input.date ?? prevDate
    const notifyIsShared = input.isShared ?? prevShared
    const notifyPayerName = input.payerName ?? prevPayerName
    const notifySplits = input.splits
      ? input.splits
          .filter((s) => s.isParticipant && s.shareAmount > 0)
          .map((s) => ({ name: s.memberName, share: s.shareAmount }))
      : prevSplits
    // input.category ?? prevCategory: prefer the edited value; fall back to
    // pre-update snapshot when the user didn't change category. Empty string
    // (user cleared category) is kept as '' — buildExpenseSection will omit
    // the 類別 row since '' is falsy.
    const notifyCategory = input.category ?? prevCategory
    await notifyMembersAboutExpense(groupId, {
      type: 'expense_updated',
      title: '編輯共同支出',
      body: `${actor?.name ?? '成員'}編輯了 ${description}（${currency(amount)}）`,
      entityId: expenseId,
      details: notifyDate
        ? {
            kind: 'expense',
            date: notifyDate,
            description,
            amount,
            isShared: notifyIsShared,
            category: notifyCategory,
            payerName: notifyPayerName,
            splits: notifySplits,
            note: input.note,
            entityId: expenseId,
          }
        : undefined,
    })
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

  // Read doc once: we need receipt paths for cleanup AND shared/description/amount for notification.
  let wasShared = false
  let description = ''
  let amount = 0
  let deleteDate: Date | undefined
  let deletePayerName: string | undefined
  let deleteCategory: string | undefined
  let deleteSplits: Array<{ name: string; share: number }> | undefined
  try {
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const d = snap.data() as {
        isShared?: boolean
        description?: string
        amount?: number
        receiptPaths?: string[]
        receiptPath?: string | null
        date?: { toDate(): Date }
        payerName?: string
        category?: string
        splits?: Array<{ memberName?: string; shareAmount?: number; isParticipant?: boolean }>
      }
      wasShared = !!d.isShared
      description = d.description ?? ''
      amount = d.amount ?? 0
      deleteDate = d.date ? d.date.toDate() : undefined
      deletePayerName = d.payerName
      deleteCategory = d.category
      if (d.splits) {
        deleteSplits = d.splits
          .filter((s) => s.isParticipant && (s.shareAmount ?? 0) > 0)
          .map((s) => ({ name: s.memberName ?? '', share: s.shareAmount ?? 0 }))
      }
      const paths = normalizeReceiptPaths(d)
      if (paths.length > 0) await deleteReceiptImages(paths)
    }
  } catch (e) {
    logger.error('[ExpenseService] Failed to read pre-delete snapshot:', e)
  }

  await deleteDoc(ref)
  if (actor) {
    try {
      await addActivityLog(groupId, {
        action: 'expense_deleted',
        actorId: actor.id,
        actorName: actor.name,
        description: `刪除支出：${description}`,
        entityId: expenseId,
      })
    } catch (e) {
      logger.error('[ExpenseService] Failed to log activity:', e)
    }
  }

  if (wasShared) {
    await notifyMembersAboutExpense(groupId, {
      type: 'expense_deleted',
      title: '刪除共同支出',
      body: `${actor?.name ?? '成員'}刪除了 ${description}（${currency(amount)}）`,
      entityId: expenseId,
      details: deleteDate
        ? {
            kind: 'expense',
            date: deleteDate,
            description,
            amount,
            isShared: true,
            category: deleteCategory,
            payerName: deletePayerName,
            splits: deleteSplits,
            deleted: true,
            entityId: expenseId,
          }
        : undefined,
    })
  }
}

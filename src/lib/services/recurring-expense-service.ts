import { collection, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import type { SplitDetail, SplitMethod, PaymentMethod, RecurringFrequency } from '@/lib/types'

function genId(): string {
  return crypto.randomUUID()
}

export interface RecurringExpenseInput {
  description: string
  amount: number | null
  category: string
  payerId: string
  payerName: string
  isShared: boolean
  splitMethod: SplitMethod
  splits: SplitDetail[]
  paymentMethod: PaymentMethod
  frequency: RecurringFrequency
  dayOfMonth?: number
  dayOfWeek?: number
  monthOfYear?: number
  startDate: Date
  endDate?: Date | null
  createdBy: string
}

export async function addRecurringExpense(groupId: string, input: RecurringExpenseInput): Promise<string> {
  const id = genId()
  const now = Timestamp.now()
  const ref = doc(collection(db, 'groups', groupId, 'recurringExpenses'), id)

  const { startDate, endDate, ...rest } = input
  await setDoc(ref, {
    ...rest,
    id,
    groupId,
    startDate: Timestamp.fromDate(startDate),
    endDate: endDate ? Timestamp.fromDate(endDate) : null,
    lastGeneratedAt: null,
    isPaused: false,
    createdAt: now,
    updatedAt: now,
  })

  logger.info('[RecurringExpenseService] Created recurring expense', id)
  return id
}

export async function updateRecurringExpense(
  groupId: string,
  id: string,
  input: Partial<RecurringExpenseInput>,
): Promise<void> {
  const ref = doc(db, 'groups', groupId, 'recurringExpenses', id)
  const { startDate, endDate, ...rest } = input
  const data: Record<string, unknown> = { ...rest, updatedAt: Timestamp.now() }

  if (startDate !== undefined) data.startDate = Timestamp.fromDate(startDate)
  if (endDate !== undefined) data.endDate = endDate ? Timestamp.fromDate(endDate) : null

  await setDoc(ref, data, { merge: true })
  logger.info('[RecurringExpenseService] Updated recurring expense', id)
}

export async function deleteRecurringExpense(groupId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'recurringExpenses', id))
  logger.info('[RecurringExpenseService] Deleted recurring expense', id)
}

export async function togglePauseRecurringExpense(groupId: string, id: string, isPaused: boolean): Promise<void> {
  const ref = doc(db, 'groups', groupId, 'recurringExpenses', id)
  await setDoc(ref, { isPaused, updatedAt: Timestamp.now() }, { merge: true })
  logger.info('[RecurringExpenseService] Toggled pause for recurring expense', { id, isPaused })
}

/** Returns the uid of the currently signed-in user, or null. */
export function getCurrentUserId(): string | null {
  return auth.currentUser?.uid ?? null
}

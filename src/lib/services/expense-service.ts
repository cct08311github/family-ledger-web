import { collection, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Expense, SplitDetail, SplitMethod, PaymentMethod } from '@/lib/types'

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

export async function addExpense(groupId: string, input: ExpenseInput): Promise<string> {
  const id = genId()
  const now = Timestamp.now()
  const ref = doc(collection(db, 'groups', groupId, 'expenses'), id)
  await setDoc(ref, {
    ...input,
    date: Timestamp.fromDate(input.date),
    receiptPath: input.receiptPaths[0] ?? null,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function updateExpense(groupId: string, expenseId: string, input: Partial<ExpenseInput>): Promise<void> {
  const ref = doc(db, 'groups', groupId, 'expenses', expenseId)
  const data: Record<string, unknown> = { ...input, updatedAt: Timestamp.now() }
  if (input.date) data.date = Timestamp.fromDate(input.date)
  if (input.receiptPaths) data.receiptPath = input.receiptPaths[0] ?? null
  await setDoc(ref, data, { merge: true })
}

export async function deleteExpense(groupId: string, expenseId: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'expenses', expenseId))
}

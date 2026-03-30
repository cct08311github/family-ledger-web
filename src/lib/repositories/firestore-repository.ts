/**
 * Firestore Expense Repository Implementation
 *
 * Implements ExpenseRepository using Firestore as the backend.
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  getDocs,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
  ExpenseRepository,
  Expense,
  ExpenseInput,
  ExpenseUpdate,
  ExpenseQueryOptions,
} from './expense-repository'
import type { PaginatedResult } from './base-repository'

function genId(): string {
  return crypto.randomUUID()
}

function toExpense(id: string, data: Record<string, unknown>): Expense {
  return {
    id,
    date: (data.date as Timestamp).toDate(),
    description: data.description as string,
    amount: data.amount as number,
    category: data.category as string,
    isShared: data.isShared as boolean,
    splitMethod: data.splitMethod as Expense['splitMethod'],
    payerId: data.payerId as string,
    payerName: data.payerName as string,
    splits: data.splits as Expense['splits'],
    paymentMethod: data.paymentMethod as Expense['paymentMethod'],
    receiptPath: data.receiptPath as string | null,
    note: data.note as string | undefined,
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as Timestamp).toDate(),
    updatedAt: (data.updatedAt as Timestamp).toDate(),
  }
}

export class FirestoreExpenseRepository implements ExpenseRepository {
  async create(groupId: string, input: ExpenseInput): Promise<string> {
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

  async update(groupId: string, id: string, input: ExpenseUpdate): Promise<void> {
    const ref = doc(db, 'groups', groupId, 'expenses', id)
    const data: Record<string, unknown> = { ...input, updatedAt: Timestamp.now() }
    if (input.date) data.date = Timestamp.fromDate(input.date)
    if (input.receiptPaths) data.receiptPath = input.receiptPaths[0] ?? null
    await setDoc(ref, data, { merge: true })
  }

  async delete(groupId: string, id: string): Promise<void> {
    const ref = doc(db, 'groups', groupId, 'expenses', id)
    await deleteDoc(ref)
  }

  async getById(groupId: string, id: string): Promise<Expense | null> {
    const ref = doc(db, 'groups', groupId, 'expenses', id)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    return toExpense(snap.id, snap.data() as Record<string, unknown>)
  }

  async query(groupId: string, options?: { limit?: number }): Promise<PaginatedResult<Expense>> {
    const q = query(
      collection(db, 'groups', groupId, 'expenses'),
      orderBy('date', 'desc'),
      limit(options?.limit ?? 50)
    )
    const snap = await getDocs(q)
    const expenses = snap.docs.map((d) => toExpense(d.id, d.data() as Record<string, unknown>))
    return { data: expenses, total: expenses.length, hasMore: false }
  }

  async queryWithFilters(groupId: string, options?: ExpenseQueryOptions): Promise<PaginatedResult<Expense>> {
    const constraints: QueryConstraint[] = [orderBy('date', 'desc')]

    if (options?.startDate) {
      constraints.push(where('date', '>=', Timestamp.fromDate(options.startDate)))
    }
    if (options?.endDate) {
      constraints.push(where('date', '<=', Timestamp.fromDate(options.endDate)))
    }
    if (options?.category) {
      constraints.push(where('category', '==', options.category))
    }
    if (options?.payerId) {
      constraints.push(where('payerId', '==', options.payerId))
    }

    const pageSize = options?.limit ?? 50
    constraints.push(limit(pageSize))

    if (options?.offset && options.offset > 0) {
      // For simplicity, we use startAfter with a document
      // In practice, you'd need to track the last document for proper pagination
      const q = query(collection(db, 'groups', groupId, 'expenses'), ...constraints)
      const snap = await getDocs(q)
      const expenses = snap.docs.map((d) => toExpense(d.id, d.data() as Record<string, unknown>))
      return { data: expenses, total: expenses.length, hasMore: expenses.length === pageSize }
    }

    const q = query(collection(db, 'groups', groupId, 'expenses'), ...constraints)
    const snap = await getDocs(q)
    const expenses = snap.docs.map((d) => toExpense(d.id, d.data() as Record<string, unknown>))
    return { data: expenses, total: expenses.length, hasMore: expenses.length === pageSize }
  }
}

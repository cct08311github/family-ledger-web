/**
 * Expense Repository Interface
 *
 * Defines the contract for expense data access.
 * Applications should depend on this interface, not the implementation.
 */

import type { SplitDetail, SplitMethod, PaymentMethod } from '@/lib/types'
import type { BaseRepository, PaginatedResult, QueryOptions } from './base-repository'

export interface Expense {
  id: string
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
  receiptPath: string | null
  note?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
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

export interface ExpenseUpdate {
  date?: Date
  description?: string
  amount?: number
  category?: string
  isShared?: boolean
  splitMethod?: SplitMethod
  payerId?: string
  payerName?: string
  splits?: SplitDetail[]
  paymentMethod?: PaymentMethod
  receiptPaths?: string[]
  note?: string
}

export interface ExpenseQueryOptions extends QueryOptions {
  startDate?: Date
  endDate?: Date
  category?: string
  payerId?: string
}

export type ExpenseRepository = BaseRepository<Expense, ExpenseInput, ExpenseUpdate> & {
  queryWithFilters(_groupId: string, _options?: ExpenseQueryOptions): Promise<PaginatedResult<Expense>>
}

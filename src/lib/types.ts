import { Timestamp } from 'firebase/firestore'

export type SplitMethod = 'equal' | 'percentage' | 'custom' | 'weight'
export type PaymentMethod = 'cash' | 'creditCard' | 'transfer'
export type MemberRole = 'admin' | 'member'

export interface SplitDetail {
  memberId: string
  memberName: string
  shareAmount: number
  paidAmount: number
  isParticipant: boolean
}

export interface Expense {
  id: string
  groupId: string
  date: Timestamp
  description: string
  amount: number
  category: string
  isShared: boolean
  splitMethod: SplitMethod
  payerId: string
  payerName: string
  splits: SplitDetail[]
  paymentMethod: PaymentMethod
  /** Storage paths for receipt images (up to 10). Replaces legacy `receiptPath`. */
  receiptPaths?: string[]
  /** @deprecated legacy single-receipt field; read-only fallback for pre-migration records */
  receiptPath?: string | null
  note?: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  /** Source recurring expense template ID */
  recurringId?: string | null
  /** Auto-generated expense pending user confirmation */
  pendingConfirm?: boolean
}

export interface FamilyMember {
  id: string
  groupId: string
  name: string
  avatarUrl?: string
  role: MemberRole
  sortOrder: number
  isCurrentUser: boolean
  createdAt: Timestamp
  updatedAt?: Timestamp
}

export interface FamilyGroup {
  id: string
  name: string
  isPrimary: boolean
  ownerUid?: string
  memberUids: string[]
  inviteCode?: string | null
  /** Optional monthly budget target in NT$. null/undefined = not set. */
  monthlyBudget?: number | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Settlement {
  id: string
  groupId: string
  fromMemberId: string
  fromMemberName: string
  toMemberId: string
  toMemberName: string
  amount: number
  note?: string
  date: Timestamp
  createdAt: Timestamp
  createdBy?: string
}

export interface Category {
  id?: string
  groupId: string
  name: string
  icon: string
  sortOrder: number
  isDefault: boolean
  isActive: boolean
  /** Optional: parent category name for sub-categories. undefined = top-level. */
  parentCategoryName?: string | null
}

export interface ActivityLog {
  id?: string
  action: string
  actorName: string
  actorId: string
  description: string
  entityId?: string
  createdAt: Timestamp
}

export interface AppNotification {
  id?: string
  type: string
  title: string
  body: string
  entityId?: string
  recipientId: string
  isRead: boolean
  createdAt: Timestamp
}

/**
 * Smart transaction rule learned from user behavior.
 * When the same description+category pair appears 3+ times, a rule is created.
 * Subsequent entries with matching description auto-fill the category.
 */
export interface TransactionRule {
  id: string
  /** Normalized description pattern (lowercased, trimmed) */
  pattern: string
  /** Category name (matches Category.name since expenses store category by name) */
  category: string
  /** Number of times this (description, category) pair has been seen */
  hitCount: number
  createdAt: Timestamp
  lastUsed: Timestamp
}

export type RecurringFrequency = 'monthly' | 'weekly' | 'yearly'

export interface RecurringExpense {
  id: string
  groupId: string
  description: string
  /** null = variable amount (generates draft requiring user to fill in) */
  amount: number | null
  category: string
  payerId: string
  payerName: string
  isShared: boolean
  splitMethod: SplitMethod
  splits: SplitDetail[]
  paymentMethod: PaymentMethod
  frequency: RecurringFrequency
  /** Day of month (1-31) for monthly frequency */
  dayOfMonth?: number
  /** Day of week (0=Sun, 1=Mon, ..., 6=Sat) for weekly frequency */
  dayOfWeek?: number
  /** Month (1-12) for yearly frequency */
  monthOfYear?: number
  startDate: Timestamp
  endDate?: Timestamp | null
  lastGeneratedAt?: Timestamp | null
  isPaused: boolean
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

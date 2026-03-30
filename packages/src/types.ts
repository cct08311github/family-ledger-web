/**
 * Shared Domain Types for Family Ledger
 *
 * These types are platform-agnostic (no Firebase dependencies).
 * Each platform (Flutter/Web) should convert to/from their specific types.
 */

// Core enums
export type SplitMethod = 'equal' | 'percentage' | 'custom'
export type PaymentMethod = 'cash' | 'creditCard' | 'transfer'
export type MemberRole = 'admin' | 'member'

// Split detail - who owes what for an expense
export interface SplitDetail {
  memberId: string
  memberName: string
  shareAmount: number
  paidAmount: number
  isParticipant: boolean
}

// Expense - a single expense record
export interface Expense {
  id: string
  groupId: string
  date: Date | string
  description: string
  amount: number
  category: string
  isShared: boolean
  splitMethod: SplitMethod
  payerId: string
  payerName: string
  splits: SplitDetail[]
  paymentMethod: PaymentMethod
  receiptPath?: string
  receiptPaths: string[]
  note?: string
  createdBy: string
  createdAt: Date | string
  updatedAt: Date | string
}

// Family member
export interface FamilyMember {
  id: string
  groupId: string
  name: string
  avatarUrl?: string
  role: MemberRole
  sortOrder: number
  isCurrentUser: boolean
}

// Family group
export interface FamilyGroup {
  id: string
  name: string
  isPrimary: boolean
  ownerUid?: string
  memberUids: string[]
  createdAt: Date | string
  updatedAt: Date | string
}

// Settlement - a debt repayment record
export interface Settlement {
  id: string
  groupId: string
  fromMemberId: string
  fromMemberName: string
  toMemberId: string
  toMemberName: string
  amount: number
  note?: string
  date: Date | string
  createdAt: Date | string
}

// Category for expenses
export interface Category {
  id?: string
  groupId: string
  name: string
  icon: string
  sortOrder: number
  isDefault: boolean
  isActive: boolean
}

// Activity log entry
export interface ActivityLog {
  id?: string
  action: string
  actorName: string
  actorId: string
  description: string
  entityId?: string
  createdAt: Date | string
}

// Notification
export interface AppNotification {
  id?: string
  type: string
  title: string
  body: string
  entityId?: string
  recipientId: string
  isRead: boolean
  createdAt: Date | string
}

// Debt between two members
export interface Debt {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

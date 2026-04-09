import { Timestamp } from 'firebase/firestore'

export type SplitMethod = 'equal' | 'percentage' | 'custom'
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
  receiptPath?: string | null
  note?: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
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

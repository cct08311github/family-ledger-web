/**
 * Shared Domain Types for Family Ledger
 *
 * These types are platform-agnostic (no Firebase dependencies).
 * Each platform (Flutter/Web) should convert to/from their specific types.
 */
export type SplitMethod = 'equal' | 'percentage' | 'custom';
export type PaymentMethod = 'cash' | 'creditCard' | 'transfer';
export type MemberRole = 'admin' | 'member';
export interface SplitDetail {
    memberId: string;
    memberName: string;
    shareAmount: number;
    paidAmount: number;
    isParticipant: boolean;
}
export interface Expense {
    id: string;
    groupId: string;
    date: Date | string;
    description: string;
    amount: number;
    category: string;
    isShared: boolean;
    splitMethod: SplitMethod;
    payerId: string;
    payerName: string;
    splits: SplitDetail[];
    paymentMethod: PaymentMethod;
    receiptPath?: string;
    receiptPaths: string[];
    note?: string;
    createdBy: string;
    createdAt: Date | string;
    updatedAt: Date | string;
}
export interface FamilyMember {
    id: string;
    groupId: string;
    name: string;
    avatarUrl?: string;
    role: MemberRole;
    sortOrder: number;
    isCurrentUser: boolean;
}
export interface FamilyGroup {
    id: string;
    name: string;
    isPrimary: boolean;
    ownerUid?: string;
    memberUids: string[];
    createdAt: Date | string;
    updatedAt: Date | string;
}
export interface Settlement {
    id: string;
    groupId: string;
    fromMemberId: string;
    fromMemberName: string;
    toMemberId: string;
    toMemberName: string;
    amount: number;
    note?: string;
    date: Date | string;
    createdAt: Date | string;
}
export interface Category {
    id?: string;
    groupId: string;
    name: string;
    icon: string;
    sortOrder: number;
    isDefault: boolean;
    isActive: boolean;
}
export interface ActivityLog {
    id?: string;
    action: string;
    actorName: string;
    actorId: string;
    description: string;
    entityId?: string;
    createdAt: Date | string;
}
export interface AppNotification {
    id?: string;
    type: string;
    title: string;
    body: string;
    entityId?: string;
    recipientId: string;
    isRead: boolean;
    createdAt: Date | string;
}
export interface Debt {
    from: string;
    fromName: string;
    to: string;
    toName: string;
    amount: number;
}
//# sourceMappingURL=types.d.ts.map
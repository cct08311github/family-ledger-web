/**
 * @family-ledger/domain
 * Shared domain logic for Family Ledger (platform-agnostic)
 */

// Types
export type { SplitMethod, PaymentMethod, MemberRole } from './types'
export type { SplitDetail, Expense, FamilyMember, FamilyGroup, Settlement, Category, ActivityLog, AppNotification, Debt } from './types'

// Split Calculator
export { calculateEqualSplit, calculatePercentageSplit, calculateCustomSplit, calculateNetBalances, simplifyDebts } from './split-calculator'
export type { Participant } from './split-calculator'

// Local Expense Parser
export { parseExpense } from './local-expense-parser'
export type { ParsedExpense } from './local-expense-parser'

// Firestore Schema
export { FirestoreSchema, groupPath, membersPath, expensesPath, settlementsPath, categoriesPath, notificationsPath, activityLogsPath } from './firestore-schema'

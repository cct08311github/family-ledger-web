/**
 * Split Calculator - Shared Domain Logic
 *
 * Handles expense splitting and debt simplification.
 * Platform-agnostic: no Firebase or platform-specific dependencies.
 */
import type { Expense, Settlement, SplitDetail, Debt } from './types';
/**
 * Split calculation helpers
 */
export interface Participant {
    id: string;
    name: string;
}
/**
 * Calculate equal split for an expense
 */
export declare function calculateEqualSplit(amount: number, payerId: string, participants: Participant[]): SplitDetail[];
/**
 * Calculate percentage-based split
 */
export declare function calculatePercentageSplit(amount: number, payerId: string, percentages: Record<string, number>, memberNames: Record<string, string>): SplitDetail[];
/**
 * Calculate custom amount split
 */
export declare function calculateCustomSplit(amount: number, payerId: string, customAmounts: Record<string, number>, memberNames: Record<string, string>): SplitDetail[];
/**
 * Calculate net balances for all members
 *
 * Positive balance = others owe this member
 * Negative balance = this member owes others
 */
export declare function calculateNetBalances(expenses: Expense[], settlements: Settlement[]): Record<string, number>;
/**
 * Simplify debts using greedy algorithm (minimum cash flow)
 *
 * Returns the minimum number of transactions needed to settle all debts.
 */
export declare function simplifyDebts(expenses: Expense[], settlements: Settlement[], nameMap: Record<string, string>): Debt[];
//# sourceMappingURL=split-calculator.d.ts.map
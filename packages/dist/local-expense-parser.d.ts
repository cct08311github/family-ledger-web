/**
 * Local Expense Parser - Shared Domain Logic
 *
 * Chinese NLP expense parsing without API key.
 * Ported from Flutter local_expense_parser.dart.
 * Platform-agnostic: no Firebase or platform-specific dependencies.
 */
export interface ParsedExpense {
    description: string;
    amount: number;
    category: string;
    date: string;
}
export declare function parseExpense(text: string, availableCategories?: string[]): ParsedExpense;
//# sourceMappingURL=local-expense-parser.d.ts.map
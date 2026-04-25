import { toDate } from './utils'
import type { Expense } from './types'

export interface ExpenseContextData {
  /** 1-indexed rank within current calendar month (1 = biggest). */
  monthRank: number
  /** Total expenses in same calendar month (denominator). */
  monthCount: number
  /** Same-description count over last 365 days, excluding the expense itself. */
  sameDescriptionCount: number
  /** Mean amount across sameDescriptionCount matches. 0 when zero matches. */
  sameDescriptionAverage: number
  /** Same-category total in current calendar month, excluding the expense itself. */
  sameCategoryMonthTotal: number
  /** Same-category count in current calendar month, excluding the expense itself. */
  sameCategoryMonthCount: number
}

interface BuildOptions {
  expense: Expense
  allExpenses: Expense[]
  /** History window for same-description match. Default 365 days. */
  descriptionWindowDays?: number
  /** Now in epoch ms; defaults to Date.now(). */
  now?: number
}

function normalize(s: string): string {
  return (s ?? '').trim().toLowerCase()
}

/**
 * Builds the in-form context strip data for the expense detail page
 * (Issue #319). Pure function: takes a target expense + all-expenses
 * snapshot, returns rank-in-month plus same-description / same-category
 * aggregates with the target excluded.
 *
 * Returns null only when the target's date is unreadable — empty
 * months and zero-history descriptions are still meaningful answers
 * (rank=1 of 1, sameDescriptionCount=0).
 */
export function buildExpenseContext({
  expense,
  allExpenses,
  descriptionWindowDays = 365,
  now = Date.now(),
}: BuildOptions): ExpenseContextData | null {
  let expenseDate: Date
  try {
    expenseDate = toDate(expense.date)
  } catch {
    return null
  }
  if (!Number.isFinite(expenseDate.getTime())) return null

  const targetYear = expenseDate.getFullYear()
  const targetMonth = expenseDate.getMonth()
  const targetDescription = normalize(expense.description)
  const targetCategory = (expense.category || '其他').trim() || '其他'
  const targetAmount = Number(expense.amount)

  let monthRank = 1
  let monthCount = 0
  let sameDescriptionCount = 0
  let sameDescriptionTotal = 0
  let sameCategoryMonthTotal = 0
  let sameCategoryMonthCount = 0

  const cutoff = now - descriptionWindowDays * 86_400_000

  for (const e of allExpenses) {
    const amount = Number(e.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    let d: Date
    try {
      d = toDate(e.date)
    } catch {
      continue
    }
    if (!Number.isFinite(d.getTime())) continue

    const isSelf = e.id === expense.id
    const inSameMonth =
      d.getFullYear() === targetYear && d.getMonth() === targetMonth

    if (inSameMonth) {
      monthCount++
      if (
        !isSelf &&
        Number.isFinite(targetAmount) &&
        amount > targetAmount
      ) {
        monthRank++
      }

      const category = (e.category || '其他').trim() || '其他'
      if (!isSelf && category === targetCategory) {
        sameCategoryMonthTotal += amount
        sameCategoryMonthCount++
      }
    }

    if (
      !isSelf &&
      targetDescription &&
      normalize(e.description) === targetDescription &&
      d.getTime() >= cutoff &&
      d.getTime() <= now
    ) {
      sameDescriptionCount++
      sameDescriptionTotal += amount
    }
  }

  return {
    monthRank,
    monthCount,
    sameDescriptionCount,
    sameDescriptionAverage:
      sameDescriptionCount > 0 ? sameDescriptionTotal / sameDescriptionCount : 0,
    sameCategoryMonthTotal,
    sameCategoryMonthCount,
  }
}

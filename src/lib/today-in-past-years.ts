import { toDate } from './utils'
import type { Expense } from './types'

export interface PastYearMemory {
  /** 1, 2, 3, ... — number of years before now. */
  yearsAgo: number
  /** YYYY-MM-DD of that year's matching day (local). */
  date: string
  total: number
  count: number
  /** Largest single expense on that date (by amount). */
  biggest: {
    id: string
    description: string
    amount: number
    category: string
  } | null
}

interface FindOptions {
  expenses: Expense[]
  now?: number
  /** Look back this many years. Default 3. */
  maxYears?: number
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Surface "what happened on this day X years ago" — Facebook-Memories
 * style. For each year 1..N back from today, return matching-day spending
 * if any exists. Empty array when no past data — caller chooses to render
 * nothing.
 *
 * Feb 29 handling: a request for Feb 29 in a non-leap-year past silently
 * skips that year (no fake matches). A leap-year today querying non-leap
 * past years matches Feb 28 instead — the closest meaningful equivalent.
 */
export function findTodayInPastYears({
  expenses,
  now = Date.now(),
  maxYears = 3,
}: FindOptions): PastYearMemory[] {
  const today = new Date(now)
  const todayMonth = today.getMonth()
  const todayDate = today.getDate()
  const todayYear = today.getFullYear()

  // Bucket expenses by date key for fast lookup.
  const byDate = new Map<string, Expense[]>()
  for (const e of expenses) {
    const amount = Number(e.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    let d: Date
    try {
      d = toDate(e.date)
    } catch {
      continue
    }
    if (!Number.isFinite(d.getTime())) continue
    const k = dateKey(d)
    const arr = byDate.get(k) ?? []
    arr.push(e)
    byDate.set(k, arr)
  }

  const results: PastYearMemory[] = []
  for (let i = 1; i <= maxYears; i++) {
    const targetYear = todayYear - i
    let targetDay = todayDate
    let targetMonth = todayMonth

    // Feb 29 fallback: if today is Feb 29 but target year not leap, try Feb 28.
    if (targetMonth === 1 && targetDay === 29) {
      const isLeapTarget =
        (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0
      if (!isLeapTarget) {
        targetDay = 28
      }
    }

    const key = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
    const matches = byDate.get(key)
    if (!matches || matches.length === 0) continue

    let total = 0
    let biggest: PastYearMemory['biggest'] = null
    for (const e of matches) {
      const amount = Number(e.amount)
      total += amount
      if (!biggest || amount > biggest.amount) {
        biggest = {
          id: e.id,
          description: (e.description || '(無描述)').trim() || '(無描述)',
          amount,
          category: (e.category || '其他').trim() || '其他',
        }
      }
    }

    results.push({
      yearsAgo: i,
      date: key,
      total,
      count: matches.length,
      biggest,
    })
  }

  return results
}

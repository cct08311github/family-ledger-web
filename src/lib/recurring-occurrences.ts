/**
 * Pure occurrence-date math for recurring templates.
 *
 * Extracted from `recurring-generator.ts` so tests can import without
 * pulling in Firebase initialization (Issue #250). The generator still
 * re-exports from here for back-compat with existing call sites.
 */
import type { RecurringExpense } from '@/lib/types'

/**
 * Returns all occurrence dates for a recurring template that fall in the range (after, before].
 * Both boundaries are exclusive on the left and inclusive on the right.
 */
export function getNextOccurrences(template: RecurringExpense, after: Date, before: Date): Date[] {
  const dates: Date[] = []

  if (template.frequency === 'weekly') {
    const targetDay = template.dayOfWeek ?? 1 // default Monday
    const cursor = new Date(after)
    cursor.setHours(0, 0, 0, 0)
    cursor.setDate(cursor.getDate() + 1)

    while (cursor <= before) {
      if (cursor.getDay() === targetDay) {
        dates.push(new Date(cursor))
        if (dates.length >= 12) break
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  } else if (template.frequency === 'monthly') {
    const targetDay = template.dayOfMonth ?? 1
    const cursor = new Date(after)
    cursor.setHours(0, 0, 0, 0)
    cursor.setDate(1)

    while (cursor <= before) {
      const year = cursor.getFullYear()
      const month = cursor.getMonth()
      const lastDay = new Date(year, month + 1, 0).getDate()
      const day = Math.min(targetDay, lastDay)
      const candidate = new Date(year, month, day, 0, 0, 0, 0)
      if (candidate > after && candidate <= before) {
        dates.push(candidate)
        if (dates.length >= 12) break
      }
      cursor.setMonth(cursor.getMonth() + 1)
    }
  } else if (template.frequency === 'yearly') {
    const targetMonth = (template.monthOfYear ?? 1) - 1
    const targetDay = template.dayOfMonth ?? 1

    for (let year = after.getFullYear(); year <= before.getFullYear(); year++) {
      const lastDay = new Date(year, targetMonth + 1, 0).getDate()
      const day = Math.min(targetDay, lastDay)
      const candidate = new Date(year, targetMonth, day, 0, 0, 0, 0)
      if (candidate > after && candidate <= before) {
        dates.push(candidate)
        if (dates.length >= 12) break
      }
    }
  }

  return dates
}

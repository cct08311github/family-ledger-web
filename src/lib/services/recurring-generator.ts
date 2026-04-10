import { collection, doc, getDocs, writeBatch, Timestamp, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import type { RecurringExpense } from '@/lib/types'

const SWEEP_THROTTLE_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Returns all occurrence dates for a recurring template that fall in the range (after, before].
 * Both boundaries are exclusive on the left and inclusive on the right.
 */
export function getNextOccurrences(template: RecurringExpense, after: Date, before: Date): Date[] {
  const dates: Date[] = []

  if (template.frequency === 'weekly') {
    const targetDay = template.dayOfWeek ?? 1 // default Monday
    // Start from the day after `after`, scan forward
    const cursor = new Date(after)
    cursor.setHours(0, 0, 0, 0)
    cursor.setDate(cursor.getDate() + 1)

    while (cursor <= before) {
      if (cursor.getDay() === targetDay) {
        dates.push(new Date(cursor))
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  } else if (template.frequency === 'monthly') {
    const targetDay = template.dayOfMonth ?? 1
    // Iterate month-by-month starting from the month containing `after`
    const cursor = new Date(after)
    cursor.setHours(0, 0, 0, 0)
    cursor.setDate(1) // go to first of the month to avoid skipping months

    while (cursor <= before) {
      const year = cursor.getFullYear()
      const month = cursor.getMonth()
      const lastDay = new Date(year, month + 1, 0).getDate()
      const day = Math.min(targetDay, lastDay)
      const candidate = new Date(year, month, day, 0, 0, 0, 0)
      if (candidate > after && candidate <= before) {
        dates.push(candidate)
      }
      cursor.setMonth(cursor.getMonth() + 1)
    }
  } else if (template.frequency === 'yearly') {
    const targetMonth = (template.monthOfYear ?? 1) - 1 // 0-indexed
    const targetDay = template.dayOfMonth ?? 1

    for (let year = after.getFullYear(); year <= before.getFullYear(); year++) {
      const lastDay = new Date(year, targetMonth + 1, 0).getDate()
      const day = Math.min(targetDay, lastDay)
      const candidate = new Date(year, targetMonth, day, 0, 0, 0, 0)
      if (candidate > after && candidate <= before) {
        dates.push(candidate)
      }
    }
  }

  return dates
}

/**
 * Generates pending expense documents for all non-paused recurring templates in a group.
 * Throttled to once per 6 hours via `lastRecurringSweepAt` on the group doc.
 * Returns the number of expense documents written.
 */
export async function generatePendingRecurring(groupId: string): Promise<number> {
  // --- Throttle check ---
  const groupRef = doc(db, 'groups', groupId)
  const groupSnap = await getDoc(groupRef)
  if (!groupSnap.exists()) return 0

  const lastSweep: Timestamp | undefined = groupSnap.data()?.lastRecurringSweepAt
  if (lastSweep) {
    const elapsed = Date.now() - lastSweep.toMillis()
    if (elapsed < SWEEP_THROTTLE_MS) {
      logger.info('[RecurringGenerator] Skipping sweep — last ran', { minutesAgo: Math.round(elapsed / 60000) })
      return 0
    }
  }

  // --- Fetch templates ---
  const templatesSnap = await getDocs(collection(db, 'groups', groupId, 'recurringExpenses'))
  if (templatesSnap.empty) {
    await setDoc(groupRef, { lastRecurringSweepAt: Timestamp.now() }, { merge: true })
    return 0
  }

  const now = new Date()
  now.setHours(23, 59, 59, 999) // generate up through end of today

  const templates = templatesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RecurringExpense)

  let totalGenerated = 0
  let batch = writeBatch(db)
  let batchCount = 0
  const MAX_BATCH = 490 // leave headroom for template updates

  const templateUpdates: Array<{ id: string; lastGeneratedAt: Timestamp }> = []

  for (const template of templates) {
    if (template.isPaused) continue

    // Skip if past endDate
    if (template.endDate && template.endDate.toDate() < now) continue

    const after = template.lastGeneratedAt ? template.lastGeneratedAt.toDate() : template.startDate.toDate()
    const occurrences = getNextOccurrences(template, after, now)

    if (occurrences.length === 0) continue

    for (const date of occurrences) {
      const expenseId = crypto.randomUUID()
      const expenseRef = doc(db, 'groups', groupId, 'expenses', expenseId)
      const nowTs = Timestamp.now()

      batch.set(expenseRef, {
        id: expenseId,
        groupId,
        date: Timestamp.fromDate(date),
        description: template.description,
        amount: template.amount ?? 0,
        category: template.category,
        isShared: template.isShared,
        splitMethod: template.splitMethod,
        payerId: template.payerId,
        payerName: template.payerName,
        splits: template.splits,
        paymentMethod: template.paymentMethod,
        recurringId: template.id,
        pendingConfirm: true,
        createdBy: template.createdBy,
        createdAt: nowTs,
        updatedAt: nowTs,
      })

      batchCount++
      totalGenerated++

      // Flush batch before hitting Firestore limit
      if (batchCount >= MAX_BATCH) {
        await batch.commit()
        batch = writeBatch(db)
        batchCount = 0
      }
    }

    templateUpdates.push({ id: template.id, lastGeneratedAt: Timestamp.fromDate(occurrences[occurrences.length - 1]) })
  }

  // Write template lastGeneratedAt updates into the same (or current) batch
  for (const update of templateUpdates) {
    const tRef = doc(db, 'groups', groupId, 'recurringExpenses', update.id)
    batch.set(tRef, { lastGeneratedAt: update.lastGeneratedAt, updatedAt: Timestamp.now() }, { merge: true })
    batchCount++

    if (batchCount >= MAX_BATCH) {
      await batch.commit()
      batch = writeBatch(db)
      batchCount = 0
    }
  }

  // Update group sweep timestamp
  batch.set(groupRef, { lastRecurringSweepAt: Timestamp.now() }, { merge: true })

  if (batchCount > 0 || totalGenerated === 0) {
    await batch.commit()
  }

  logger.info('[RecurringGenerator] Generated pending expenses', { groupId, totalGenerated })
  return totalGenerated
}

/** Confirm a pending auto-generated expense (set pendingConfirm = false). */
export async function confirmPendingExpense(groupId: string, expenseId: string): Promise<void> {
  const ref = doc(db, 'groups', groupId, 'expenses', expenseId)
  await setDoc(ref, { pendingConfirm: false, updatedAt: Timestamp.now() }, { merge: true })
}

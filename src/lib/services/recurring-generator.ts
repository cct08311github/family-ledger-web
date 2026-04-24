import { collection, doc, getDocs, writeBatch, Timestamp, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import type { RecurringExpense } from '@/lib/types'

const SWEEP_THROTTLE_MS = 6 * 60 * 60 * 1000 // 6 hours

// Re-export for back-compat — pure occurrence math lives in its own file so
// tests can import it without pulling in Firebase init. Issue #250.
export { getNextOccurrences } from '@/lib/recurring-occurrences'
import { getNextOccurrences } from '@/lib/recurring-occurrences'

/**
 * Generates pending expense documents for all non-paused recurring templates in a group.
 * Throttled to once per 6 hours via `lastRecurringSweepAt` on the group doc.
 * Returns the number of expense documents written.
 */
export async function generatePendingRecurring(groupId: string): Promise<number> {
  // S1: ensure user is authenticated before generating expenses
  const currentUid = auth.currentUser?.uid
  if (!currentUid) {
    logger.info('[RecurringGenerator] Skipping sweep — user not authenticated')
    return 0
  }

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

    // S2: skip variable-amount templates — they can't be auto-generated meaningfully
    if (template.amount === null) continue

    const after = template.lastGeneratedAt ? template.lastGeneratedAt.toDate() : template.startDate.toDate()
    const occurrences = getNextOccurrences(template, after, now)

    if (occurrences.length === 0) continue

    for (const date of occurrences) {
      // S4: use deterministic ID to prevent duplicate writes from concurrent sweeps
      const dateKey = date.toISOString().split('T')[0]
      const expenseId = `${template.id}_${dateKey}`
      const expenseRef = doc(db, 'groups', groupId, 'expenses', expenseId)


      // C2: recompute equal splits — match buildEqualSplits() remainder-to-LAST logic
      const amount = template.amount
      const participants = template.splits.filter((s) => s.isParticipant)
      const per = participants.length > 0 ? Math.round(amount / participants.length) : 0
      const remainder = participants.length > 0 ? amount - per * participants.length : 0
      let participantIndex = 0
      const participantCount = participants.length
      const computedSplits = template.splits.map((s) => {
        if (!s.isParticipant) {
          return { ...s, shareAmount: 0, paidAmount: s.memberId === template.payerId ? amount : 0 }
        }
        const isLast = participantIndex === participantCount - 1
        const shareAmount = isLast ? per + remainder : per
        participantIndex++
        return {
          ...s,
          shareAmount,
          paidAmount: s.memberId === template.payerId ? amount : 0,
        }
      })

      batch.set(expenseRef, {
        id: expenseId,
        groupId,
        date: Timestamp.fromDate(date),
        description: template.description,
        amount,
        category: template.category,
        isShared: template.isShared,
        splitMethod: template.splitMethod,
        payerId: template.payerId,
        payerName: template.payerName,
        splits: computedSplits,
        paymentMethod: template.paymentMethod,
        recurringId: template.id,
        pendingConfirm: true,
        createdBy: currentUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
  await setDoc(ref, { pendingConfirm: false, updatedAt: serverTimestamp() }, { merge: true })
}

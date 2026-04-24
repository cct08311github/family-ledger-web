/**
 * Budget-alert orchestrator (Issue #236). Decides + sends + records.
 *
 * Called from the home page when the monthly total changes. Uses a
 * Firestore transaction on the group doc so the read-decide-write cycle
 * is atomic — prevents two tabs from sending duplicate emails when a new
 * expense crosses a threshold at the same moment.
 */
import { doc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  shouldTriggerAlert,
  buildAlertMessage,
  type BudgetAlertHistory,
} from '@/lib/budget-alert'
import { notifyByEmailFanOut } from '@/lib/services/email-notification'
import { logger } from '@/lib/logger'

interface GroupDocSubset {
  monthlyBudget?: number | null
  budgetAlertHistory?: BudgetAlertHistory
  memberUids?: string[]
  name?: string
}

export interface BudgetAlertTriggerArgs {
  groupId: string
  currentTotal: number
  /** 1..12 — caller supplies so we can stub in tests and avoid Date() inside. */
  year: number
  month: number
  /** Uids to notify; typically `memberUids` excluding the acting user is fine. */
  recipientOverride?: readonly string[]
}

/**
 * Check the group's monthly budget vs current total; if a threshold has just
 * been crossed, atomically record in `budgetAlertHistory` and fan out email.
 *
 * Best-effort: on any failure logs and returns. Caller should treat this as
 * fire-and-forget (do NOT await in the critical path). The transaction
 * provides single-flight safety across tabs / clients.
 */
export async function maybeSendBudgetAlert(args: BudgetAlertTriggerArgs): Promise<void> {
  const { groupId, currentTotal, year, month, recipientOverride } = args
  try {
    const groupRef = doc(db, 'groups', groupId)
    const outcome = await runTransaction(db, async (tx) => {
      const snap = await tx.get(groupRef)
      if (!snap.exists()) return null
      const data = snap.data() as GroupDocSubset
      const budget = data.monthlyBudget ?? 0
      const history = data.budgetAlertHistory ?? {}
      const decision = shouldTriggerAlert({
        currentTotal,
        budget: budget ?? 0,
        history,
        year,
        month,
      })
      if (!decision) return null

      // Optimistically mark all the keys (main + alsoMark) so a concurrent
      // transaction reading right after us won't re-decide. This is the
      // reason we use a transaction rather than just Firestore `update`.
      const newHistory: BudgetAlertHistory = { ...history, [decision.historyKey]: true }
      for (const k of decision.alsoMark) newHistory[k] = true
      tx.update(groupRef, { budgetAlertHistory: newHistory })

      return {
        decision,
        data: {
          currentTotal,
          budget: budget ?? 0,
          groupName: data.name,
          memberUids: data.memberUids ?? [],
        },
      }
    })

    if (!outcome) return

    const { decision, data } = outcome
    const msg = buildAlertMessage(decision, {
      currentTotal: data.currentTotal,
      budget: data.budget,
      groupName: data.groupName,
    })
    const recipients = recipientOverride ?? data.memberUids
    if (!recipients || recipients.length === 0) return
    await notifyByEmailFanOut({
      groupId,
      recipientUids: recipients,
      title: msg.title,
      body: msg.body,
      groupName: data.groupName,
    })
  } catch (e) {
    logger.error('[BudgetAlert] Failed to check/send alert', e)
  }
}

import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import type { TransactionRule } from '@/lib/types'

/**
 * Smart transaction rules: learn from user's manual categorization and auto-suggest
 * the same category next time they record an expense with a similar description.
 *
 * A rule is "active" once the same (pattern, category) pair has been seen 3+ times.
 * Rules are scoped per group and stored at: groups/{groupId}/transactionRules/{ruleId}
 */

const MIN_HIT_COUNT_FOR_SUGGESTION = 3
/**
 * Category length upper bound (UTF-16 code units). Must stay in sync with
 * firestore.rules `transactionRules` + `categories` create rules (Issue #165).
 */
const MAX_CATEGORY_LENGTH = 30

/** Normalize a description for pattern matching: lowercase, trim, collapse whitespace. */
export function normalizePattern(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Called after an expense is saved. Increments hitCount for matching (pattern, category)
 * rule, or creates one if it doesn't exist. No-op for empty inputs.
 */
export async function learnFromExpense(
  groupId: string,
  description: string,
  category: string,
): Promise<void> {
  const pattern = normalizePattern(description)
  if (!pattern || !category || !groupId) return
  // Defense in depth: reject oversize category client-side to match the
  // server-side firestore.rules cap (Issue #165). Real user-selected categories
  // always come from a bounded <select>, so this mainly guards against bugs or
  // future programmatic callers — and keeps the client from eating a rejected
  // Firestore write round-trip. We logger.warn (not throw) to stay within the
  // service's best-effort contract while still surfacing likely programming
  // errors in system_logs.
  if (category.length > MAX_CATEGORY_LENGTH) {
    logger.warn('[TransactionRules] Skipping learnFromExpense: category exceeds max length', {
      length: category.length,
      max: MAX_CATEGORY_LENGTH,
    })
    return
  }

  try {
    const q = query(
      collection(db, 'groups', groupId, 'transactionRules'),
      where('pattern', '==', pattern),
      where('category', '==', category),
    )
    const snap = await getDocs(q)

    if (snap.empty) {
      await addDoc(collection(db, 'groups', groupId, 'transactionRules'), {
        pattern,
        category,
        hitCount: 1,
        createdAt: serverTimestamp(),
        lastUsed: serverTimestamp(),
      })
    } else {
      const existing = snap.docs[0]
      const current = (existing.data().hitCount as number | undefined) ?? 0
      await updateDoc(existing.ref, {
        hitCount: current + 1,
        lastUsed: serverTimestamp(),
      })
    }
  } catch (e) {
    // Non-fatal: rule learning is best-effort, don't block the expense save path
    logger.warn('[TransactionRules] Failed to learn rule:', e)
  }
}

/**
 * Query rules matching the given description and return the best category suggestion.
 * Returns null if no rule has reached the minimum hit count.
 *
 * Strategy:
 *  1. Exact pattern match (normalized) → pick the rule with highest hitCount
 *  2. Requires hitCount >= MIN_HIT_COUNT_FOR_SUGGESTION
 */
export async function suggestCategory(
  groupId: string,
  description: string,
): Promise<string | null> {
  const pattern = normalizePattern(description)
  if (!pattern || !groupId || pattern.length < 2) return null

  try {
    const q = query(
      collection(db, 'groups', groupId, 'transactionRules'),
      where('pattern', '==', pattern),
    )
    const snap = await getDocs(q)
    if (snap.empty) return null

    // Pick the category with the highest hitCount
    let best: { category: string; hitCount: number } | null = null
    for (const d of snap.docs) {
      const data = d.data() as TransactionRule
      if (data.hitCount < MIN_HIT_COUNT_FOR_SUGGESTION) continue
      if (!best || data.hitCount > best.hitCount) {
        best = { category: data.category, hitCount: data.hitCount }
      }
    }
    return best?.category ?? null
  } catch (e) {
    logger.warn('[TransactionRules] Failed to fetch suggestion:', e)
    return null
  }
}

/**
 * List all rules for a group (for debug / future settings UI).
 * Not used in current flow but exported for completeness.
 */
export async function listRules(groupId: string): Promise<TransactionRule[]> {
  const snap = await getDocs(collection(db, 'groups', groupId, 'transactionRules'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TransactionRule)
}

export const TRANSACTION_RULE_MIN_HITS = MIN_HIT_COUNT_FOR_SUGGESTION

// Re-export Timestamp for test utilities if needed
export { Timestamp }

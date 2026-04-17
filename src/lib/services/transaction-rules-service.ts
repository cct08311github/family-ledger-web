import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
    // Auth errors (PERMISSION_DENIED / UNAUTHENTICATED) must not be silently
    // swallowed — the caller may need to trigger a re-auth or membership flow.
    // Everything else (network blips, rate limits) stays best-effort.
    // Issue #164.
    if (isAuthError(e)) throw e
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

    // Pick the category with the highest hitCount.
    // Defensive: skip docs missing `hitCount` — `undefined < N` is false (NaN),
    // so without this guard such rows would silently "win" the first-match slot
    // and prevent any valid rule from being selected. Exposed by
    // __tests__/transaction-rules-service.test.ts "skips docs with missing hitCount".
    let best: { category: string; hitCount: number } | null = null
    for (const d of snap.docs) {
      const data = d.data() as TransactionRule
      if (typeof data.hitCount !== 'number') continue
      if (data.hitCount < MIN_HIT_COUNT_FOR_SUGGESTION) continue
      if (!best || data.hitCount > best.hitCount) {
        best = { category: data.category, hitCount: data.hitCount }
      }
    }
    return best?.category ?? null
  } catch (e) {
    if (isAuthError(e)) throw e
    logger.warn('[TransactionRules] Failed to fetch suggestion:', e)
    return null
  }
}

/**
 * List all rules for a group (for debug / settings UI).
 */
export async function listRules(groupId: string): Promise<TransactionRule[]> {
  const snap = await getDocs(collection(db, 'groups', groupId, 'transactionRules'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TransactionRule)
}

/** Default staleness cutoff for pruneStaleRules, in days. */
export const STALE_RULE_DAYS = 90

export interface PruneResult {
  scanned: number
  pruned: number
  kept: number
  /** Rules skipped because deletion failed (e.g. transient network). */
  failed: number
}

/**
 * Prune rules that have never reached the suggestion threshold AND have been
 * idle for `staleDays` days. Active learned rules (hitCount >= threshold) are
 * preserved regardless of age — those are actual user learning.
 *
 * This is the after-the-fact mitigation for Issue #167 (per-group doc count
 * flood): Firestore rules cannot cap collection size, so we give the owner a
 * cleanup tool analogous to the orphan receipt cleanup (#157).
 *
 * Caller must be group owner — enforced by firestore.rules
 * `transactionRules` delete rule (already requires isGroupMember).
 */
export async function pruneStaleRules(
  groupId: string,
  staleDays = STALE_RULE_DAYS,
): Promise<PruneResult> {
  if (!groupId) return { scanned: 0, pruned: 0, kept: 0, failed: 0 }
  const cutoffMs = Date.now() - staleDays * 24 * 60 * 60 * 1000
  const rules = await listRules(groupId)
  let pruned = 0
  let failed = 0
  await Promise.all(
    rules.map(async (r) => {
      const hitCount = typeof r.hitCount === 'number' ? r.hitCount : 0
      const lastUsedMs = r.lastUsed?.toMillis?.() ?? 0
      // Conservative: only delete rules that never activated AND are old.
      // Active rules with hitCount >= threshold are the user's real learning
      // and must never be auto-pruned.
      if (hitCount >= MIN_HIT_COUNT_FOR_SUGGESTION) return
      if (lastUsedMs > cutoffMs) return
      try {
        await deleteDoc(doc(db, 'groups', groupId, 'transactionRules', r.id))
        pruned++
      } catch (e) {
        // Permission errors should surface so the UI can prompt for re-auth
        // (consistent with #164). Other errors are counted as failures and the
        // prune continues — mirrors orphan-scanner's delete-best-effort pattern.
        if (isAuthError(e)) throw e
        failed++
        logger.warn('[TransactionRules] pruneStaleRules: failed to delete rule', {
          ruleId: r.id, err: e,
        })
      }
    }),
  )
  return {
    scanned: rules.length,
    pruned,
    kept: rules.length - pruned - failed,
    failed,
  }
}

export const TRANSACTION_RULE_MIN_HITS = MIN_HIT_COUNT_FOR_SUGGESTION

// Re-export Timestamp for test utilities if needed
export { Timestamp }

/**
 * Firebase Firestore error codes that indicate the current session cannot
 * perform the operation regardless of retries — either the user lost
 * membership, was signed out, or the security rules reject the request.
 * These must not be swallowed by the best-effort contract; the caller
 * needs to know so it can surface a re-auth / membership prompt.
 *
 * Reference: https://firebase.google.com/docs/reference/js/firestore_.firestoreerror
 * Issue #164.
 */
const AUTH_ERROR_CODES = new Set(['permission-denied', 'unauthenticated'])

/**
 * Returns true if `err` is a Firebase auth/permission error that should NOT
 * be silently swallowed (e.g. PERMISSION_DENIED / UNAUTHENTICATED). Non-auth
 * errors (network blips, rate limits) remain best-effort and are swallowed
 * by the caller.
 */
export function isAuthError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' && AUTH_ERROR_CODES.has(code)
}

/**
 * QuickAddBar draft persistence (Issue #199).
 *
 * Symmetry with ExpenseForm: ExpenseForm already persists a draft in
 * sessionStorage so a user who switches tabs mid-entry doesn't lose work.
 * QuickAddBar on the home page had no such protection — this module is the
 * shared, pure core those components' storage layer calls through.
 *
 * Security / storage trade-offs (informed decision):
 *   - The `description` field can contain sensitive PII (e.g. medical/legal
 *     notes). sessionStorage is chosen over localStorage (shorter lifespan,
 *     cleared when the tab closes) and over Firestore (offline-friendly,
 *     zero server cost, zero sync lag for an unfinished draft).
 *   - Trade-off: any JS running same-origin (malicious extension, XSS) can
 *     read this draft. That threat model is broader than the draft itself
 *     (the same attacker could exfiltrate the Firestore session), so adding
 *     encryption here is theatre, but the risk is logged here for future
 *     maintainers who might be tempted to lengthen the TTL.
 *   - 24h TTL matches ExpenseForm for symmetry.
 *
 * Pure functions only. React integration lives in the component.
 */

export interface QuickAddDraft {
  description: string
  amount: string
  category: string
  savedAt: number
}

export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24h, mirrors ExpenseForm

/**
 * Build a sessionStorage key for a user+group draft.
 *
 * Firebase Auth UIDs and Firestore auto-IDs are base62 (no `-`), so today the
 * naive `${groupId}-${uid}` format is collision-free. We still URL-encode
 * each part to stay robust if groups ever move to a custom ID scheme that
 * includes separators — collisions like (group `a-b` + uid `c`) vs
 * (group `a` + uid `b-c`) would otherwise silently share a draft.
 */
export function buildDraftKey(
  groupId: string | null | undefined,
  uid: string | null | undefined,
): string | null {
  if (!groupId || !uid) return null
  return `quick-add-draft:${encodeURIComponent(groupId)}:${encodeURIComponent(uid)}`
}

export function serializeDraft(draft: QuickAddDraft): string {
  return JSON.stringify(draft)
}

function coerceString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function hasMeaningfulContent(d: QuickAddDraft): boolean {
  return d.description.trim().length > 0 || d.amount.trim().length > 0
}

export interface ParseDraftOptions {
  /** If true (default), drop drafts whose description+amount are both empty. */
  requireContent?: boolean
}

/**
 * Parse a serialized draft. Returns null on any of:
 *   - malformed JSON
 *   - missing `savedAt`
 *   - draft older than DRAFT_MAX_AGE_MS
 *   - (when `requireContent`) empty after string coercion
 *
 * `now` is injectable so tests are deterministic without freezing Date.
 */
export function parseDraft(
  raw: string,
  now: number,
  opts: ParseDraftOptions = {},
): QuickAddDraft | null {
  const requireContent = opts.requireContent ?? true
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (typeof o.savedAt !== 'number' || !Number.isFinite(o.savedAt)) return null
  if (now - o.savedAt > DRAFT_MAX_AGE_MS) return null

  const draft: QuickAddDraft = {
    description: coerceString(o.description),
    amount: coerceString(o.amount),
    category: coerceString(o.category),
    savedAt: o.savedAt,
  }

  if (requireContent && !hasMeaningfulContent(draft)) return null
  return draft
}

import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import type { ExpenseChange } from '@/lib/expense-diff'

/**
 * Email notification pipeline for in-app notifications (Issue #187).
 *
 * Flow:
 *   1. Caller (expense/settlement service) creates in-app notification doc
 *   2. Caller ALSO calls `notifyByEmail(groupId, recipientUid, subject, text)`
 *   3. We look up `groups/{g}/userPreferences/{uid}` to check `emailEnabled` + `email`
 *   4. If opted in, write a mail doc to root `mail` collection
 *   5. Firebase "Trigger Email from Firestore" extension (ext-firestore-send-email)
 *      picks up the mail doc and dispatches via Gmail SMTP
 *
 * Best-effort: email failures never surface to the caller. In-app notification
 * is the source of truth; email is a convenience on top.
 *
 * Phase 2 prerequisites (user ops, not code):
 *   - Firebase project on Blaze plan
 *   - "Trigger Email from Firestore" extension installed and configured
 *   - Gmail app password, SMTP URI saved in extension config
 *   - See CLAUDE.md "Email Notifications" section for full checklist
 */

export interface UserEmailPreference {
  emailEnabled: boolean
  email: string
}

/**
 * Build the subject + text body for a mail doc. Pure helper so it's unit-testable
 * without Firebase. Keeps subject prefix consistent across all events.
 */
export interface EmailPayload {
  subject: string
  text: string
}

/**
 * Structured detail objects passed to buildEmailPayload (Issue #213).
 * When `details` is present the text body becomes multi-line.
 */
export type EmailDetails =
  | {
      kind: 'expense'
      date: Date | { toDate(): Date }
      description: string
      amount: number
      isShared: boolean
      /** Category label, e.g. "餐飲". Renders as "類別：餐飲" when present. (Issue #215) */
      category?: string
      payerName?: string
      splits?: Array<{ name: string; share: number }>
      note?: string
      /** Firestore document id — used to build a deep link to the edit page. (Issue #215) */
      entityId?: string
      /**
       * Set when this notification is being sent for a DELETE event (the expense
       * has just been deleted). Controls footer routing — deep link goes to
       * /settings/activity-log (expense) so the user can still find the audit
       * trail after the entity is gone.
       *
       * This is NOT a soft-delete state flag; it describes the notification event
       * kind, not the current entity state. (Issue #215)
       */
      deleted?: boolean
      /**
       * List of changed fields for edit notifications. When present and non-empty,
       * renders a "變更：" section in the email body so recipients can see what
       * changed. Undefined or empty array → section omitted. (Issue #216)
       */
      changes?: ExpenseChange[]
    }
  | {
      kind: 'settlement'
      date: Date | { toDate(): Date }
      fromName: string
      toName: string
      amount: number
      /** Firestore document id — used to confirm the entity exists. (Issue #215) */
      entityId?: string
      /**
       * Set when this notification is being sent for a DELETE event (the
       * settlement has just been deleted). Deep link still routes to /split
       * (the settlement history page).
       *
       * This is NOT a soft-delete state flag; it describes the notification event
       * kind, not the current entity state. (Issue #215)
       */
      deleted?: boolean
    }
  | {
      kind: 'settlement_batch'
      count: number
      /**
       * Pass the FULL list — `buildEmailPayload` truncates to the top 3 for
       * display. `count` must reflect the full count including those not passed
       * (in case you still want to truncate upstream for size reasons).
       */
      items?: Array<{ fromName: string; toName: string; amount: number }>
    }

/**
 * Strip CR/LF from a string to prevent SMTP header injection when the value
 * ends up in a `Subject:` or similar header. A malicious actor writing
 * `description` or `actorName` with `\r\nBcc: evil@attacker.com` could
 * otherwise inject additional headers. Called on every untrusted input that
 * feeds buildEmailPayload.
 */
function sanitizeHeader(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim()
}

/**
 * App URL used in email body for the "go to app" link. Reads from
 * `NEXT_PUBLIC_APP_URL` env var with a generic fallback — avoids hardcoding
 * a Tailscale/personal URL into source. Set in `.env.local`.
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://family-ledger-web.local/'

/**
 * Maximum character length for untrusted string fields in the email body.
 * Prevents oversized Firestore mail documents.
 */
const EMAIL_FIELD_LIMIT = 500

/**
 * Truncate a string to `limit` characters, appending `…` when exceeded.
 */
function truncate(s: string, limit: number = EMAIL_FIELD_LIMIT): string {
  return s.length > limit ? s.slice(0, limit) + '…' : s
}

/**
 * YYYY-MM-DD date formatter pinned to Asia/Taipei timezone.
 * Handles both native Date and Firestore Timestamp-like objects.
 * Try/catch mirrors the coerceDate pattern used elsewhere in this repo for
 * Firestore Timestamp duck-type inputs.
 *
 * Locale + timezone fixed to Asia/Taipei so all recipients (regardless of
 * where the server runs) see the expense's local date. en-CA locale gives
 * YYYY-MM-DD; pinning timezone to Asia/Taipei keeps dates stable regardless
 * of server deployment location.
 */
export function formatEmailDate(d: Date | { toDate(): Date } | null | undefined): string {
  if (!d) return ''
  let date: Date
  try {
    if (d instanceof Date) {
      date = d
    } else if (typeof (d as { toDate?: unknown }).toDate === 'function') {
      date = (d as { toDate(): Date }).toDate()
    } else {
      return ''
    }
  } catch {
    return ''
  }
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Format an amount as NT$ 1,000 using locale-aware thousands separator.
 * Pinning to zh-TW ensures thousand separators even on small-ICU Node builds.
 */
function fmtAmount(n: number): string {
  return `NT$ ${n.toLocaleString('zh-TW')}`
}

/**
 * Build multi-line body section for an expense EmailDetails.
 */
function buildExpenseSection(d: Extract<EmailDetails, { kind: 'expense' }>): string {
  const lines: string[] = []
  lines.push(`項目：${truncate(d.description)}`)
  lines.push(`金額：${fmtAmount(d.amount)}`)
  lines.push(`日期：${formatEmailDate(d.date)}`)
  if (d.category) {
    lines.push(`類別：${truncate(d.category)}`)
  }
  if (d.payerName) {
    lines.push(`付款人：${truncate(d.payerName)}`)
  }

  if (!d.isShared) {
    lines.push('分攤：個人支出（不分攤）')
  } else if (!d.splits || d.splits.length === 0) {
    // Shared but no split detail available
    lines.push('分攤：（無）')
  } else {
    const splitLines = d.splits.map((s) => `  - ${truncate(s.name)}  ${fmtAmount(s.share)}`)
    lines.push(`分攤（${d.splits.length} 人）：`)
    lines.push(...splitLines)
  }

  if (d.changes && d.changes.length > 0) {
    lines.push('變更：')
    for (const c of d.changes) {
      lines.push(`  - ${c.label}：${truncate(c.from, EMAIL_FIELD_LIMIT)} → ${truncate(c.to, EMAIL_FIELD_LIMIT)}`)
    }
  }

  if (d.note) {
    lines.push(`備註：${truncate(d.note)}`)
  }

  return lines.join('\n')
}

/**
 * Build multi-line body section for a settlement EmailDetails.
 */
function buildSettlementSection(d: Extract<EmailDetails, { kind: 'settlement' }>): string {
  const lines: string[] = []
  lines.push(`日期：${formatEmailDate(d.date)}`)
  lines.push(`金額：${fmtAmount(d.amount)}`)
  lines.push(`${truncate(d.fromName)} → ${truncate(d.toName)}`)
  return lines.join('\n')
}

/**
 * Build multi-line body section for a batch settlement EmailDetails.
 * The builder owns the top-3 truncation — callers should pass the FULL items
 * array. The `…` indicator is appended when the total count exceeds 3.
 */
function buildSettlementBatchSection(d: Extract<EmailDetails, { kind: 'settlement_batch' }>): string {
  const lines: string[] = []
  lines.push(`共 ${d.count} 筆：`)
  if (d.items && d.items.length > 0) {
    const top = d.items.slice(0, 3)
    for (const item of top) {
      lines.push(`  - ${truncate(item.fromName)} → ${truncate(item.toName)}  ${fmtAmount(item.amount)}`)
    }
    if (d.count > top.length) {
      lines.push('  …')
    }
  }
  return lines.join('\n')
}

/**
 * Build the details section string based on the EmailDetails kind.
 */
function buildDetailsSection(details: EmailDetails): string {
  if (details.kind === 'expense') return buildExpenseSection(details)
  if (details.kind === 'settlement') return buildSettlementSection(details)
  return buildSettlementBatchSection(details)
}

const UNSUBSCRIBE_HINT = '若不想再收到此類郵件，請到 設定 → 🔔 Email 通知 關閉開關。'

/**
 * Validate that an entity id looks like a Firestore auto-id before embedding
 * it in an email URL. Firestore auto-ids are [A-Za-z0-9_-]{1,64} in practice.
 * Reject anything longer or with unusual chars to prevent oversized URLs in
 * email bodies. A malicious writer would need Firestore write access anyway, so
 * this is belt-and-suspenders only — defence in depth, not a primary control.
 *
 * Exported for direct test assertions.
 */
export function isValidEntityId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id)
}

/**
 * Build the entity-specific deep link URL, or null when no meaningful link can
 * be derived. Exported for unit-testability. (Issue #215)
 *
 * Rules are deliberately aligned with `getNotificationHref` in
 * `src/lib/notification-navigation.ts` so in-app clicks and email clicks land
 * on the same page. Keep the two in sync when either changes.
 *
 * - expense (not deleted) + valid entityId → /expense/:entityId (edit page)
 * - expense (not deleted), no entityId     → /records (list fallback, mirrors
 *                                            getNotificationHref for expense_added/updated)
 * - expense (deleted)                      → /settings/activity-log (entity gone)
 * - settlement (any)                       → /split
 * - settlement_batch                       → /split
 * - otherwise                              → null
 */
export function buildDeepLinkUrl(details: EmailDetails | undefined, baseUrl: string): string | null {
  if (!details) return null
  // Strip trailing slash to avoid double-slashes in concatenation.
  const base = baseUrl.replace(/\/+$/, '')

  switch (details.kind) {
    case 'expense': {
      if (details.deleted) return `${base}/settings/activity-log`
      const id = details.entityId?.trim()
      // Defensive: reject malformed ids before embedding in URL.
      if (id && isValidEntityId(id)) return `${base}/expense/${encodeURIComponent(id)}`
      // No entityId (or invalid): fall back to records list, matching
      // getNotificationHref behaviour for expense_added / expense_updated.
      return `${base}/records`
    }
    case 'settlement':
      return `${base}/split`
    case 'settlement_batch':
      return `${base}/split`
  }
}

/**
 * Pick the footer label for the deep link based on the notification kind.
 *
 * - expense (deleted)  → "查看紀錄" (routes to activity log)
 * - expense (active)   → "查看此筆" (routes to edit page or records list)
 * - settlement / batch → "前往結算" (routes to /split, a list page — "查看此筆"
 *                         would be misleading because there is no entity detail page)
 */
function pickDeepLinkLabel(details: EmailDetails | undefined): string {
  if (!details) return '查看此筆'
  switch (details.kind) {
    case 'expense':
      return details.deleted ? '查看紀錄' : '查看此筆'
    case 'settlement':
    case 'settlement_batch':
      return '前往結算'
  }
}

/**
 * Build the plain-text email footer with optional deep link. (Issue #215)
 *
 * - When a deep link is available AND differs from the home URL, show both:
 *     {label}：{DEEP_LINK}
 *     前往首頁：{APP_URL}
 * - Otherwise show a single generic "前往查看" line (backward-compat).
 *
 * The label is chosen by `pickDeepLinkLabel` so settlement links read
 * "前往結算" instead of "查看此筆".
 */
function buildEmailFooter(details: EmailDetails | undefined): string {
  const deepLink = buildDeepLinkUrl(details, APP_URL)
  const homeUrl = APP_URL.replace(/\/+$/, '')

  // `buildDeepLinkUrl` uses `base = APP_URL.replace(/\/+$/, '')` so its output
  // can never literally equal APP_URL (with trailing slash) unless both are
  // effectively empty. Comparing against homeUrl is sufficient.
  if (deepLink && deepLink !== homeUrl) {
    const label = pickDeepLinkLabel(details)
    return `—\n${label}：${deepLink}\n前往首頁：${APP_URL}\n${UNSUBSCRIBE_HINT}`
  }
  return `—\n前往查看：${APP_URL}\n${UNSUBSCRIBE_HINT}`
}

export function buildEmailPayload(args: {
  title: string
  body: string
  groupName?: string
  details?: EmailDetails
}): EmailPayload {
  const safeTitle = sanitizeHeader(args.title)
  const safeGroup = args.groupName ? sanitizeHeader(args.groupName) : ''
  const groupTag = safeGroup ? `【${safeGroup}】` : '【家計本】'
  // Body is plain text (not a header), so CRLF is allowed — just avoid the
  // hardcoded Tailscale URL by routing via env var.

  const footer = buildEmailFooter(args.details)

  let text: string
  if (args.details) {
    const detailSection = buildDetailsSection(args.details)
    text = `${args.body}\n\n${detailSection}\n\n${footer}`
  } else {
    text = `${args.body}\n\n${footer}`
  }

  return {
    subject: `${groupTag} ${safeTitle}`,
    text,
  }
}

/**
 * Fetch a recipient's email preference from Firestore. Returns null on any error
 * or if the user has not opted in.
 */
export async function getRecipientEmailPreference(
  groupId: string,
  recipientUid: string,
): Promise<UserEmailPreference | null> {
  try {
    const ref = doc(db, 'groups', groupId, 'userPreferences', recipientUid)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const data = snap.data() as Partial<UserEmailPreference>
    if (!data.emailEnabled || !data.email) return null
    return { emailEnabled: true, email: data.email }
  } catch (e) {
    logger.warn('[EmailNotification] Failed to read user preference', { groupId, recipientUid, err: e })
    return null
  }
}

/**
 * Fire-and-forget: write a mail doc for the given recipient if they've opted in.
 * Errors are logged (not thrown) — email is best-effort, must never block the
 * calling notification flow.
 */
export async function notifyByEmail(args: {
  groupId: string
  recipientUid: string
  title: string
  body: string
  groupName?: string
  details?: EmailDetails
}): Promise<void> {
  try {
    const pref = await getRecipientEmailPreference(args.groupId, args.recipientUid)
    if (!pref) return // not opted in or lookup failed
    const payload = buildEmailPayload({
      title: args.title,
      body: args.body,
      groupName: args.groupName,
      details: args.details,
    })
    await addDoc(collection(db, 'mail'), {
      to: pref.email,
      message: {
        subject: payload.subject,
        text: payload.text,
      },
      // Metadata for audit / debugging. Extension ignores extra fields.
      meta: {
        groupId: args.groupId,
        recipientUid: args.recipientUid,
      },
      createdAt: serverTimestamp(),
    })
  } catch (e) {
    logger.error('[EmailNotification] notifyByEmail failed', e)
  }
}

/**
 * Fan out email notifications to multiple recipients in parallel.
 * Convenience wrapper for the notifyMembersAboutX pattern.
 */
export async function notifyByEmailFanOut(args: {
  groupId: string
  recipientUids: readonly string[]
  title: string
  body: string
  groupName?: string
  details?: EmailDetails
}): Promise<void> {
  await Promise.all(
    args.recipientUids.map((uid) =>
      notifyByEmail({
        groupId: args.groupId,
        recipientUid: uid,
        title: args.title,
        body: args.body,
        groupName: args.groupName,
        details: args.details,
      }),
    ),
  )
}

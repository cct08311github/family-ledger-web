import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'

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
      date: Date
      description: string
      amount: number
      isShared: boolean
      payerName?: string
      splits?: Array<{ name: string; share: number }>
      note?: string
    }
  | {
      kind: 'settlement'
      date: Date
      fromName: string
      toName: string
      amount: number
    }
  | {
      kind: 'settlement_batch'
      count: number
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
 * Locale-independent YYYY-MM-DD date formatter.
 * Handles both native Date and Firestore Timestamp-like objects that have a
 * `toDate()` method.
 */
export function formatEmailDate(d: Date | { toDate(): Date }): string {
  const date = typeof (d as { toDate?: unknown }).toDate === 'function'
    ? (d as { toDate(): Date }).toDate()
    : (d as Date)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Format an amount as NT$ 1,000 using locale-aware thousands separator.
 */
function fmtAmount(n: number): string {
  return `NT$ ${n.toLocaleString()}`
}

/**
 * Build multi-line body section for an expense EmailDetails.
 */
function buildExpenseSection(d: Extract<EmailDetails, { kind: 'expense' }>): string {
  const lines: string[] = []
  lines.push(`項目：${d.description}`)
  lines.push(`金額：${fmtAmount(d.amount)}`)
  lines.push(`日期：${formatEmailDate(d.date)}`)
  if (d.payerName) {
    lines.push(`付款人：${d.payerName}`)
  }

  if (!d.isShared) {
    lines.push('分攤：個人支出（不分攤）')
  } else if (!d.splits || d.splits.length === 0) {
    // Shared but no split detail available
    lines.push('分攤：（無）')
  } else {
    const splitLines = d.splits.map((s) => `  - ${s.name}  ${fmtAmount(s.share)}`)
    lines.push(`分攤（${d.splits.length} 人）：`)
    lines.push(...splitLines)
  }

  if (d.note) {
    lines.push(`備註：${d.note}`)
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
  lines.push(`${d.fromName} → ${d.toName}`)
  return lines.join('\n')
}

/**
 * Build multi-line body section for a batch settlement EmailDetails.
 */
function buildSettlementBatchSection(d: Extract<EmailDetails, { kind: 'settlement_batch' }>): string {
  const lines: string[] = []
  lines.push(`共 ${d.count} 筆：`)
  if (d.items && d.items.length > 0) {
    const top = d.items.slice(0, 3)
    for (const item of top) {
      lines.push(`  - ${item.fromName} → ${item.toName}  ${fmtAmount(item.amount)}`)
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

const EMAIL_FOOTER = `—\n前往查看：${APP_URL}\n若不想再收到此類郵件，請到 設定 → 🔔 Email 通知 關閉開關。`

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

  let text: string
  if (args.details) {
    const detailSection = buildDetailsSection(args.details)
    text = `${args.body}\n\n${detailSection}\n\n${EMAIL_FOOTER}`
  } else {
    text = `${args.body}\n\n${EMAIL_FOOTER}`
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

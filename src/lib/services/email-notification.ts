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

export function buildEmailPayload(args: {
  title: string
  body: string
  groupName?: string
}): EmailPayload {
  const groupTag = args.groupName ? `【${args.groupName}】` : '【家計本】'
  return {
    subject: `${groupTag} ${args.title}`,
    text: `${args.body}\n\n—\n前往查看：https://claude-openclaw.tail7fcdd.ts.net/family-ledger-web/\n若不想再收到此類郵件，請到 設定 → 個人通知 取消勾選 Email 通知。`,
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
}): Promise<void> {
  try {
    const pref = await getRecipientEmailPreference(args.groupId, args.recipientUid)
    if (!pref) return // not opted in or lookup failed
    const payload = buildEmailPayload({
      title: args.title,
      body: args.body,
      groupName: args.groupName,
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
}): Promise<void> {
  await Promise.all(
    args.recipientUids.map((uid) =>
      notifyByEmail({
        groupId: args.groupId,
        recipientUid: uid,
        title: args.title,
        body: args.body,
        groupName: args.groupName,
      }),
    ),
  )
}

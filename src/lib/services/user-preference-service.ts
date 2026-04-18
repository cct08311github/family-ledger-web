import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

import { logger } from '@/lib/logger'

/**
 * Per-user preferences stored at: groups/{groupId}/userPreferences/{uid}
 *
 * Fields:
 *   - linkedMemberId: Firebase Auth user → family member binding
 *   - emailEnabled: opt-in for email notifications (Issue #187)
 *   - email: recipient address for email notifications (Issue #187)
 */

export async function setCurrentMember(groupId: string, memberId: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')

  const ref = doc(db, 'groups', groupId, 'userPreferences', uid)
  await setDoc(ref, {
    linkedMemberId: memberId,
    updatedAt: Timestamp.now(),
  }, { merge: true })
  logger.info(`[UserPreference] User ${uid} linked to member ${memberId} in group ${groupId}`)
}

export async function getCurrentMemberId(groupId: string): Promise<string | null> {
  const uid = auth.currentUser?.uid
  if (!uid) return null

  const ref = doc(db, 'groups', groupId, 'userPreferences', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data().linkedMemberId ?? null
}

/**
 * Enable or disable email notifications for the current user in the given group.
 * When enabling, stores the user's Firebase Auth email alongside the flag.
 * Issue #187.
 */
export async function setEmailNotificationEnabled(groupId: string, enabled: boolean): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  if (enabled && !user.email) {
    throw new Error('Firebase Auth user has no email; cannot enable email notifications')
  }
  const ref = doc(db, 'groups', groupId, 'userPreferences', user.uid)
  await setDoc(ref, {
    emailEnabled: enabled,
    email: enabled ? user.email : null,
    updatedAt: Timestamp.now(),
  }, { merge: true })
  logger.info(`[UserPreference] Email ${enabled ? 'enabled' : 'disabled'} for user ${user.uid} in group ${groupId}`)
}

export async function getEmailNotificationEnabled(groupId: string): Promise<boolean> {
  const uid = auth.currentUser?.uid
  if (!uid) return false
  const ref = doc(db, 'groups', groupId, 'userPreferences', uid)
  const snap = await getDoc(ref)
  return snap.exists() && snap.data().emailEnabled === true
}

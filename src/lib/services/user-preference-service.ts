import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

import { logger } from '@/lib/logger'

/**
 * Per-user preference for linking a Firebase Auth user to a family member.
 * Stored at: groups/{groupId}/userPreferences/{uid}
 */

export async function setCurrentMember(groupId: string, memberId: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')

  const ref = doc(db, 'groups', groupId, 'userPreferences', uid)
  await setDoc(ref, {
    linkedMemberId: memberId,
    updatedAt: Timestamp.now(),
  })
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

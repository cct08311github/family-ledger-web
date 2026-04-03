'use client'

import { useEffect, useState, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth'
import { useMembers } from '@/lib/hooks/use-members'
import { setCurrentMember as setCurrentMemberService } from '@/lib/services/user-preference-service'

import { logger } from '@/lib/logger'

/**
 * Hook that returns the current user's linked member ID for a group.
 * Subscribes to `groups/{groupId}/userPreferences/{uid}` via onSnapshot.
 * Falls back to the legacy `member.isCurrentUser` field if no preference exists.
 */
export function useCurrentMember(groupId: string | undefined) {
  const { user } = useAuth()
  const { members } = useMembers(groupId)
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Track whether a userPreference doc exists (null = not yet checked)
  const [hasPreferenceDoc, setHasPreferenceDoc] = useState<boolean | null>(null)

  useEffect(() => {
    if (!groupId || !user?.uid) {
      setCurrentMemberId(null)
      setLoading(false)
      setHasPreferenceDoc(null)
      return
    }

    const ref = doc(db, 'groups', groupId, 'userPreferences', user.uid)
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setCurrentMemberId(snap.data().linkedMemberId ?? null)
          setHasPreferenceDoc(true)
        } else {
          setCurrentMemberId(null)
          setHasPreferenceDoc(false)
        }
        setLoading(false)
      },
      (error) => {
        logger.error('[useCurrentMember] onSnapshot error:', error)
        setHasPreferenceDoc(false)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [groupId, user?.uid])

  // Backward compatibility: fallback to legacy isCurrentUser if no preference doc
  const resolvedMemberId =
    currentMemberId ??
    (hasPreferenceDoc === false
      ? (members.find((m) => m.isCurrentUser)?.id ?? null)
      : null)

  const setCurrentMember = useCallback(
    async (memberId: string) => {
      if (!groupId) return
      await setCurrentMemberService(groupId, memberId)
    },
    [groupId],
  )

  return {
    currentMemberId: resolvedMemberId,
    setCurrentMember,
    loading,
  }
}

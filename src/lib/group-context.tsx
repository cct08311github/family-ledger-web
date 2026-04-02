'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth'
import type { FamilyGroup } from '@/lib/types'
import { logger } from '@/lib/logger'

const STORAGE_KEY = 'active-group-id'

interface GroupContextType {
  groups: FamilyGroup[]
  activeGroup: FamilyGroup | null
  setActiveGroupId: (_id: string) => void
  removeGroup: (_id: string) => void
  loading: boolean
}

const GroupContext = createContext<GroupContextType>({
  groups: [],
  activeGroup: null,
  setActiveGroupId: () => {},
  removeGroup: () => {},
  loading: true,
})

export function GroupProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [groups, setGroups] = useState<FamilyGroup[]>([])
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(STORAGE_KEY)
  })
  const [loading, setLoading] = useState(true)

  // Subscribe to all groups where user is a member
  useEffect(() => {
    if (!user) {
      setGroups([])
      setLoading(false)
      return
    }

    let settled = false
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true
        logger.warn('[GroupContext] Snapshot timeout')
        setLoading(false)
      }
    }, 8000)

    const q = query(
      collection(db, 'groups'),
      where('memberUids', 'array-contains', user.uid),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!settled) {
          settled = true
          window.clearTimeout(timeout)
        }
        const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyGroup)
        setGroups(fetched)
        setLoading(false)
      },
      (err) => {
        if (!settled) {
          settled = true
          window.clearTimeout(timeout)
        }
        logger.error('[GroupContext] Snapshot error:', err)
        setLoading(false)
      },
    )

    return () => {
      window.clearTimeout(timeout)
      unsub()
    }
  }, [user])

  // Resolve active group (memoized)
  const activeGroup = useMemo(() => {
    if (groups.length === 0) return null
    if (activeGroupId) {
      const found = groups.find((g) => g.id === activeGroupId)
      if (found) return found
    }
    const primary = groups.find((g) => g.isPrimary)
    if (primary) return primary
    return groups[0]
  }, [groups, activeGroupId])

  // Clean up stale activeGroupId when resolved group differs
  const resolvedId = activeGroup?.id ?? null
  useEffect(() => {
    if (!loading && groups.length > 0 && activeGroupId && resolvedId !== activeGroupId) {
      setActiveGroupIdState(resolvedId)
      if (resolvedId) {
        localStorage.setItem(STORAGE_KEY, resolvedId)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [loading, groups.length, activeGroupId, resolvedId])

  const setActiveGroupId = useCallback((id: string) => {
    setActiveGroupIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const removeGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id))
  }, [])

  // Stable context value
  const value = useMemo(() => ({
    groups, activeGroup, setActiveGroupId, removeGroup, loading,
  }), [groups, activeGroup, setActiveGroupId, removeGroup, loading])

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  )
}

export const useGroupContext = () => useContext(GroupContext)

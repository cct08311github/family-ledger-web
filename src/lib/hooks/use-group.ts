'use client'

import { useGroupContext } from '@/lib/group-context'
import type { FamilyGroup } from '@/lib/types'

/** 取得目前使用者的主要群組（backward compatible） */
export function useGroup(): {
  group: FamilyGroup | null
  groups: FamilyGroup[]
  loading: boolean
  setActiveGroupId: (id: string) => void
  removeGroup: (id: string) => void
} {
  const { activeGroup, groups, loading, setActiveGroupId, removeGroup } = useGroupContext()
  return { group: activeGroup, groups, loading, setActiveGroupId, removeGroup }
}

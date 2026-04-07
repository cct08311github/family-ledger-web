'use client'

import { useGroupData } from '@/lib/group-data-context'

export function useMembers() {
  const { members, membersLoading: loading } = useGroupData()
  return { members, loading }
}

'use client'

import { useGroupData } from '@/lib/group-data-context'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useMembers(_groupId?: string) {
  const { members, membersLoading: loading } = useGroupData()
  return { members, loading }
}

'use client'

import { useGroupData } from '@/lib/group-data-context'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useSettlements(_groupId?: string) {
  const { settlements, settlementsLoading: loading } = useGroupData()
  return { settlements, loading }
}

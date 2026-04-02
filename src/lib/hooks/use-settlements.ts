'use client'

import { useGroupData } from '@/lib/group-data-context'

export function useSettlements(_groupId?: string) {
  const { settlements, settlementsLoading: loading } = useGroupData()
  return { settlements, loading }
}

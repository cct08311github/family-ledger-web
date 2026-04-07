'use client'

import { useGroupData } from '@/lib/group-data-context'

export function useSettlements() {
  const { settlements, settlementsLoading: loading } = useGroupData()
  return { settlements, loading }
}

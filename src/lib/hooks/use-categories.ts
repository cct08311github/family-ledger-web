'use client'

import { useGroupData } from '@/lib/group-data-context'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useCategories(_groupId?: string) {
  const { categories, categoriesLoading: loading } = useGroupData()
  return { categories, loading }
}

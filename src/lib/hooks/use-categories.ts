'use client'

import { useGroupData } from '@/lib/group-data-context'

export function useCategories() {
  const { categories, categoriesLoading: loading } = useGroupData()
  return { categories, loading }
}

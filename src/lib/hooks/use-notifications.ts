'use client'

import { useGroupData } from '@/lib/group-data-context'

export function useNotifications() {
  const { notifications, unreadCount } = useGroupData()
  return { notifications, unreadCount }
}

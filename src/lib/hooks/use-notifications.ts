'use client'

import { useGroupData } from '@/lib/group-data-context'

export function useNotifications(_groupId?: string, _recipientId?: string) {
  const { notifications, unreadCount } = useGroupData()
  return { notifications, unreadCount }
}

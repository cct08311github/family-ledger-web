'use client'

import { useGroupData } from '@/lib/group-data-context'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useNotifications(_groupId?: string, _recipientId?: string) {
  const { notifications, unreadCount } = useGroupData()
  return { notifications, unreadCount }
}

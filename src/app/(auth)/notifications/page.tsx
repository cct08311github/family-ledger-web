'use client'

import { useGroup } from '@/lib/hooks/use-group'
import { useNotifications } from '@/lib/hooks/use-notifications'
import { useAuth } from '@/lib/auth'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/services/notification-service'
import { toDate, fmtDateFull } from '@/lib/utils'

const TYPE_ICONS: Record<string, string> = {
  expense_added: '💸',
  settlement_created: '✅',
  member_added: '👤',
  reminder: '🔔',
}

export default function NotificationsPage() {
  const { group } = useGroup()
  const { user } = useAuth()
  const { notifications, unreadCount } = useNotifications(group?.id, user?.uid)

  async function handleMarkAllRead() {
    if (!group || !user) return
    await markAllNotificationsRead(group.id, user.uid)
  }

  async function handleMarkOneRead(notifId: string) {
    if (!group) return
    await markNotificationRead(group.id, notifId)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">通知</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
          >
            全部標為已讀
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <div className="text-4xl opacity-30">🔔</div>
          <p className="text-[var(--muted-foreground)]">沒有通知</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          {notifications.map((notif) => (
            <button
              key={notif.id ?? notif.title}
              onClick={() => notif.id && !notif.isRead && handleMarkOneRead(notif.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0 text-left transition-colors ${
                !notif.isRead
                  ? 'bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 cursor-pointer'
                  : 'cursor-default'
              }`}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 85%)' }}>
                {TYPE_ICONS[notif.type] ?? '🔔'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{notif.title}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{notif.body}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">
                  {fmtDateFull(toDate(notif.createdAt))}
                </div>
              </div>
              {!notif.isRead && (
                <div className="w-2 h-2 rounded-full bg-[var(--primary)] flex-shrink-0 mt-1.5" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

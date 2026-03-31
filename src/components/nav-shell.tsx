'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useGroup } from '@/lib/hooks/use-group'
import { useAuth } from '@/lib/auth'
import { useNotifications } from '@/lib/hooks/use-notifications'

const BASE = '/family-ledger-web'

const navItems = [
  { href: `${BASE}/`, label: '首頁', icon: '🏠' },
  { href: `${BASE}/split`, label: '拆帳', icon: '💰' },
  { href: `${BASE}/records`, label: '記錄', icon: '📋' },
  { href: `${BASE}/statistics`, label: '統計', icon: '📊' },
  { href: `${BASE}/settings`, label: '設定', icon: '⚙️' },
]

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { group } = useGroup()
  const { user } = useAuth()
  const { unreadCount } = useNotifications(group?.id, user?.uid)

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 border-r border-[var(--border)] bg-[var(--card)] p-4 gap-1 shrink-0">
        <div className="flex items-center justify-between px-3 py-4">
          <h1 className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
            💰 家計本
          </h1>
          <Link href={`${BASE}/notifications`} className="relative p-1.5 rounded-lg hover:bg-[var(--muted)] transition">
            <span className="text-lg">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--destructive)] text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
        {navItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
        <div className="flex-1" />
        <Link
          href={`${BASE}/expense/new`}
          className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg font-medium text-sm bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition"
        >
          ＋ 記帳
        </Link>
      </nav>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0 overflow-auto">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-[var(--border)] bg-[var(--card)] flex items-center justify-around h-16 z-50">
        {navItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 text-xs ${
                active ? 'font-bold' : 'text-[var(--muted-foreground)]'
              }`}
              style={active ? { color: 'var(--primary)' } : undefined}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
        <Link
          href={`${BASE}/notifications`}
          aria-label={unreadCount > 0 ? `通知，${unreadCount} 則未讀` : '通知'}
          className="relative flex flex-col items-center gap-0.5 text-xs"
          style={{ color: pathname.startsWith(`${BASE}/notifications`) ? 'var(--primary)' : 'var(--muted-foreground)' }}
        >
          <span className="text-lg" aria-hidden="true">🔔</span>
          <span>通知</span>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-[var(--destructive)] text-white text-[9px] font-bold flex items-center justify-center" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      </nav>

      {/* Mobile FAB */}
      <Link
        href={`${BASE}/expense/new`}
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg z-50 bg-[var(--primary)] text-[var(--primary-foreground)]"
      >
        ＋
      </Link>
    </div>
  )
}

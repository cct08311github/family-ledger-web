'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNotifications } from '@/lib/hooks/use-notifications'
import { GroupSwitcher } from '@/components/group-switcher'

const navItems = [
  { href: `/`, label: '首頁', icon: '🏠' },
  { href: `/split`, label: '拆帳', icon: '💰' },
  { href: `/records`, label: '記錄', icon: '📋' },
  { href: `/statistics`, label: '統計', icon: '📊' },
  { href: `/settings`, label: '設定', icon: '⚙️' },
]

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { unreadCount } = useNotifications()
  const [fabOpen, setFabOpen] = useState(false)
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    setIsOnline(navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 border-r border-[var(--border)] bg-[var(--card)] p-4 gap-1 shrink-0">
        <div className="flex items-center justify-between px-3 py-4">
          <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--primary)' }}>
            💰 家計本
          </h1>
          <Link href="/notifications" className="relative p-1.5 rounded-lg hover:bg-[var(--muted)] transition">
            <span className="text-lg">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--destructive)] text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
        <div className="px-1 pb-2">
          <GroupSwitcher />
        </div>
        {navItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'text-[var(--primary-foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
              }`}
              style={active ? { background: 'linear-gradient(135deg, var(--primary), oklch(from var(--primary) calc(l - 0.05) c h))' } : undefined}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
        <div className="relative mt-2">
          {sidebarMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSidebarMenuOpen(false)} />
              <div className="absolute top-full left-0 right-0 mt-2 z-50 flex flex-col gap-1.5 animate-slide-up">
                <Link href="/expense/new" onClick={() => setSidebarMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--muted)] btn-press"
                  style={{ boxShadow: 'var(--card-shadow-hover)' }}>
                  <span>💵</span> 新增支出
                </Link>
                <Link href="/split?action=transfer" onClick={() => setSidebarMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--muted)] btn-press"
                  style={{ boxShadow: 'var(--card-shadow-hover)' }}>
                  <span>🔄</span> 記錄轉帳
                </Link>
              </div>
            </>
          )}
          <button
            onClick={() => setSidebarMenuOpen(!sidebarMenuOpen)}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold text-sm btn-primary btn-press"
          >
            ＋ 記帳
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 overflow-auto">
        {/* Offline banner */}
        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
            style={{ background: 'oklch(0.82 0.15 85)', color: 'oklch(0.25 0.06 85)' }}
          >
            <span aria-hidden="true">⚠</span>
            目前離線，顯示的是快取資料
          </div>
        )}
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-[var(--card)]/80 backdrop-blur-lg border-b border-[var(--border)]">
          <span className="text-sm font-black" style={{ color: 'var(--primary)' }}>💰 家計本</span>
          <div className="w-40">
            <GroupSwitcher />
          </div>
        </div>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-lg flex items-center justify-around h-20 pb-[env(safe-area-inset-bottom)] z-50">
        {navItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] px-2 text-[13px] transition-all ${
                active ? 'font-bold scale-110' : 'text-[var(--muted-foreground)]'
              }`}
              style={active ? { color: 'var(--primary)' } : undefined}
            >
              <span className="text-2xl leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
        <Link
          href="/notifications"
          aria-label={unreadCount > 0 ? `通知，${unreadCount} 則未讀` : '通知'}
          className="relative flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] px-2 text-[13px] transition-all"
          style={{ color: pathname.startsWith('/notifications') ? 'var(--primary)' : undefined }}
        >
          <span className="text-2xl leading-none" aria-hidden="true">🔔</span>
          <span className={pathname.startsWith('/notifications') ? 'font-bold' : 'text-[var(--muted-foreground)]'}>通知</span>
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full bg-[var(--destructive)] text-white text-[10px] font-bold flex items-center justify-center" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      </nav>

      {/* Mobile FAB */}
      {fabOpen && (
        <div className="md:hidden fixed inset-0 z-40 modal-backdrop" onClick={() => setFabOpen(false)} />
      )}
      {fabOpen && (
        <div className="md:hidden fixed bottom-36 right-4 z-50 flex flex-col gap-2.5 items-end">
          <Link
            href="/expense/new"
            onClick={() => setFabOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-[var(--card)] border border-[var(--border)] btn-press animate-slide-up stagger-1"
            style={{ boxShadow: 'var(--card-shadow-hover)' }}
          >
            <span>💵</span> 新增支出
          </Link>
          <Link
            href="/split?action=transfer"
            onClick={() => setFabOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-[var(--card)] border border-[var(--border)] btn-press animate-slide-up"
            style={{ boxShadow: 'var(--card-shadow-hover)' }}
          >
            <span>🔄</span> 記錄轉帳
          </Link>
          <Link
            href="/settings/recurring?action=new"
            onClick={() => setFabOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-[var(--card)] border border-[var(--border)] btn-press animate-slide-up"
            style={{ boxShadow: 'var(--card-shadow-hover)' }}
          >
            <span>🔁</span> 新增定期支出
          </Link>
        </div>
      )}
      <button
        onClick={() => setFabOpen(!fabOpen)}
        className={`md:hidden fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl z-50 btn-primary transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`}
      >
        ＋
      </button>
    </div>
  )
}

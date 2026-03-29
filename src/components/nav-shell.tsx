'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: '首頁', icon: '🏠' },
  { href: '/split', label: '拆帳', icon: '💰' },
  { href: '/records', label: '記錄', icon: '📋' },
  { href: '/statistics', label: '統計', icon: '📊' },
  { href: '/settings', label: '設定', icon: '⚙️' },
]

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 border-r border-[var(--border)] bg-[var(--card)] p-4 gap-1 shrink-0">
        <h1 className="text-xl font-bold px-3 py-4" style={{ color: 'var(--primary)' }}>
          💰 家計本
        </h1>
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
          href="/expense/new"
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
      </nav>

      {/* Mobile FAB */}
      <Link
        href="/expense/new"
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg z-50 bg-[var(--primary)] text-[var(--primary-foreground)]"
      >
        ＋
      </Link>
    </div>
  )
}

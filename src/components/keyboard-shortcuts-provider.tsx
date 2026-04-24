'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useKeyboardShortcuts, type ShortcutBinding } from '@/hooks/use-keyboard-shortcut'

/**
 * Wraps the auth area with global keyboard shortcuts (Issue #235).
 * Shortcuts are desktop-friendly and ignored when the user is typing in
 * form controls or contenteditable regions.
 */
const NAV_SHORTCUTS = [
  { key: 'h', label: '首頁', path: '/' },
  { key: 'n', label: '新增支出', path: '/expense/new' },
  { key: 'r', label: '所有記錄', path: '/records' },
  { key: 's', label: '結算', path: '/split' },
  { key: 't', label: '統計', path: '/statistics' },
] as const

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false)

  const bindings = useMemo<ShortcutBinding[]>(
    () => [
      ...NAV_SHORTCUTS.map((s) => ({
        key: s.key,
        handler: () => router.push(s.path),
      })),
      {
        key: '?',
        shift: true,
        handler: () => setCheatsheetOpen((v) => !v),
      },
      {
        key: '/',
        shift: true,
        handler: () => setCheatsheetOpen((v) => !v),
      },
      {
        key: 'Escape',
        handler: () => setCheatsheetOpen(false),
      },
    ],
    [router],
  )

  useKeyboardShortcuts(bindings)

  return (
    <>
      {children}
      {cheatsheetOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 animate-fade-in"
          onClick={() => setCheatsheetOpen(false)}
          role="dialog"
          aria-label="鍵盤快捷鍵"
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm mx-4 space-y-3 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">⌨️ 鍵盤快捷鍵</h2>
              <button
                type="button"
                onClick={() => setCheatsheetOpen(false)}
                aria-label="關閉"
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5 text-sm">
              {NAV_SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-[var(--muted-foreground)]">{s.label}</span>
                  <kbd className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--muted)] font-mono text-xs">
                    {s.key.toUpperCase()}
                  </kbd>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] mt-2">
                <span className="text-[var(--muted-foreground)]">開關此面板</span>
                <kbd className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--muted)] font-mono text-xs">
                  ?
                </kbd>
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] pt-2">
              輸入欄位聚焦時不觸發。
            </p>
          </div>
        </div>
      )}
    </>
  )
}

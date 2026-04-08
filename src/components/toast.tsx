'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

type ToastLevel = 'success' | 'error' | 'warning'

interface Toast {
  id: string
  message: string
  level: ToastLevel
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (message: string, level?: ToastLevel) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger slide-up animation on mount
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const bgStyle: React.CSSProperties =
    toast.level === 'error'
      ? { background: 'var(--destructive)', color: '#fff' }
      : toast.level === 'warning'
        ? { background: 'oklch(0.82 0.15 85)', color: 'oklch(0.25 0.06 85)' }
        : { background: 'oklch(from var(--primary) calc(l - 0.05) c h)', color: '#fff' }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        ...bgStyle,
        transition: 'opacity 250ms ease, transform 250ms ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
      }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs w-full pointer-events-auto"
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {toast.level === 'error' ? '✕' : toast.level === 'warning' ? '⚠' : '✓'}
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="關閉通知"
        className="shrink-0 opacity-80 hover:opacity-100 transition-opacity leading-none text-base"
      >
        ×
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, level: ToastLevel = 'success') => {
      const id = typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())
      setToasts((prev) => [...prev, { id, message, level }])

      // Auto-dismiss after 3s for success and warning; error stays until closed
      if (level !== 'error') {
        setTimeout(() => removeToast(id), 3000)
      }
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast container — bottom-right on desktop, bottom-center on mobile */}
      <div
        aria-label="通知"
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[200] flex flex-col gap-2 items-end pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'warning'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void
    error: (msg: string) => void
    warning: (msg: string) => void
  }
}

const ToastContext = createContext<ToastContextType>({
  toast: {
    success: () => {},
    error: () => {},
    warning: () => {},
  },
})

const ICONS: Record<ToastType, string> = {
  success: '✓',
  warning: '⚠',
  error: '✕',
}

const MAX_TOASTS = 3
let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const add = useCallback((type: ToastType, message: string) => {
    const id = nextId++
    setToasts((prev) => {
      const updated = [...prev, { id, type, message }]
      // Dismiss oldest if over limit
      if (updated.length > MAX_TOASTS) {
        const oldest = updated[0]
        dismiss(oldest.id)
        return updated.slice(1)
      }
      return updated
    })
    // Error toasts stay until manually closed
    if (type !== 'error') {
      const timer = setTimeout(() => dismiss(id), 3000)
      timers.current.set(id, timer)
    }
  }, [dismiss])

  // Cleanup timers on unmount
  useEffect(() => {
    const currentTimers = timers.current
    return () => { currentTimers.forEach((t) => clearTimeout(t)) }
  }, [])

  const toast = {
    success: (msg: string) => add('success', msg),
    error: (msg: string) => add('error', msg),
    warning: (msg: string) => add('warning', msg),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div
          role="region"
          aria-label="通知訊息"
          style={{
            position: 'fixed',
            bottom: '5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger fade-in on mount
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const bgColor =
    toast.type === 'success'
      ? 'var(--primary)'
      : toast.type === 'error'
        ? 'var(--destructive)'
        : 'oklch(0.75 0.15 85)'

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.625rem 1rem',
        borderRadius: '9999px',
        background: bgColor,
        color: 'var(--primary-foreground)',
        fontSize: '0.875rem',
        fontWeight: 600,
        boxShadow: '0 4px 16px oklch(0 0 0 / 0.25)',
        pointerEvents: 'all',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        whiteSpace: 'nowrap',
        maxWidth: '90vw',
      }}
    >
      <span aria-hidden="true" style={{ flexShrink: 0 }}>{ICONS[toast.type]}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast.message}</span>
      {toast.type === 'error' && (
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="關閉"
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: '0 0.25rem',
            fontSize: '1rem',
            lineHeight: 1,
            opacity: 0.8,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

export function useToast(): ToastContextType['toast'] {
  return useContext(ToastContext).toast
}

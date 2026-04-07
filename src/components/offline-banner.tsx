'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/toast'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const toast = useToast()

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine)

    function handleOffline() {
      setIsOffline(true)
    }

    function handleOnline() {
      setIsOffline(false)
      toast.success('已恢復連線')
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [toast])

  if (!isOffline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: 'oklch(0.88 0.12 85)',
        color: 'oklch(0.3 0.08 85)',
        borderBottom: '1px solid oklch(0.78 0.14 85)',
        padding: '0.5rem 1rem',
        fontSize: '0.8125rem',
        fontWeight: 600,
        textAlign: 'center',
      }}
    >
      ⚡ 目前離線，顯示的是快取資料
    </div>
  )
}

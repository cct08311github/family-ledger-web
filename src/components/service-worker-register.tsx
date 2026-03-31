'use client'

import { useEffect } from 'react'

import { logger } from '@/lib/logger'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        logger.warn('SW registration failed:', err)
      })
    }
  }, [])

  return null
}

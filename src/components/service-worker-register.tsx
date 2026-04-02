'use client'

import { useEffect } from 'react'

import { logger } from '@/lib/logger'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const basePath = process.env.__NEXT_ROUTER_BASEPATH || ''
      navigator.serviceWorker.register(`${basePath}/sw.js`).catch((err) => {
        logger.warn('SW registration failed:', err)
      })
    }
  }, [])

  return null
}

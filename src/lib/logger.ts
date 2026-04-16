/* eslint-disable no-console */

/**
 * Shared logger for family-ledger-web
 *
 * - Console output always (dev + prod) for errors/warnings so browser DevTools
 *   still shows them.
 * - In production, `error` and `warn` are ALSO forwarded to Firestore
 *   `system_logs` so prod issues can be diagnosed after the fact.
 * - Forwarding is dynamic-imported to avoid pulling Firebase into initial
 *   bundles that don't need logging.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDev = process.env.NODE_ENV !== 'production'

function forwardToBackend(level: 'warn' | 'error', message: string, data?: unknown): void {
  if (typeof window === 'undefined') return
  // Fire-and-forget lazy import. Must never throw back into caller.
  import('./services/log-service')
    .then(({ writeSystemLog }) => writeSystemLog(level, message, data))
    .catch(() => { /* silent */ })
}

function format(level: LogLevel, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString().slice(11, 19)
  const prefix = `[${timestamp}][${level.toUpperCase()}]`
  if (data === undefined) return `${prefix} ${message}`
  if (data instanceof Error) {
    return `${prefix} ${message} ${data.message}${data.stack ? '\n' + data.stack : ''}`
  }
  try {
    return `${prefix} ${message} ${JSON.stringify(data)}`
  } catch {
    return `${prefix} ${message} [unserializable data]`
  }
}

export const logger = {
  debug(message: string, data?: unknown) {
    if (isDev) console.debug(format('debug', message, data))
  },
  info(message: string, data?: unknown) {
    if (isDev) console.info(format('info', message, data))
  },
  warn(message: string, data?: unknown) {
    console.warn(format('warn', message, data))
    forwardToBackend('warn', message, data)
  },
  error(message: string, data?: unknown) {
    console.error(format('error', message, data))
    forwardToBackend('error', message, data)
  },
}

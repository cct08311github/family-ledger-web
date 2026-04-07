/* eslint-disable no-console */

/**
 * Shared logger for family-ledger-web
 * Uses console in development, can be silenced in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDev = process.env.NODE_ENV !== 'production'

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
  },
  error(message: string, data?: unknown) {
    console.error(format('error', message, data))
  },
}

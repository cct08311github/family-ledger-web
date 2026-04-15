import { addDoc, collection, serverTimestamp, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

/**
 * Client-side system log service.
 *
 * Errors (and warnings in prod) are written to Firestore `system_logs` so
 * production issues can be diagnosed without requiring the user to copy
 * browser console messages. Writes are fire-and-forget — they must never
 * block UI or throw back into calling code.
 *
 * A simple rate-limiter prevents log floods (e.g. an effect in a tight loop
 * that errors repeatedly) from running up Firestore write cost.
 */

type LogLevel = 'warn' | 'error'

export interface SystemLog {
  id: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  userId?: string | null
  userAgent?: string
  url?: string
  appVersion?: string
  createdAt: Timestamp
}

const MAX_WRITES_PER_MINUTE = 30
const rateLimitWindow: number[] = []

function serializeValue(v: unknown, depth = 0): unknown {
  if (depth > 3) return '[depth limit]'
  if (v === null || v === undefined) return v
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (v instanceof Error) {
    return {
      name: v.name,
      message: v.message,
      stack: v.stack?.split('\n').slice(0, 12).join('\n'),
      code: (v as { code?: string }).code,
    }
  }
  if (Array.isArray(v)) return v.slice(0, 20).map((item) => serializeValue(item, depth + 1))
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = serializeValue(val, depth + 1)
    }
    return out
  }
  return String(v)
}

function withinRateLimit(): boolean {
  const now = Date.now()
  while (rateLimitWindow.length > 0 && now - rateLimitWindow[0] > 60_000) rateLimitWindow.shift()
  if (rateLimitWindow.length >= MAX_WRITES_PER_MINUTE) return false
  rateLimitWindow.push(now)
  return true
}

export async function writeSystemLog(
  level: LogLevel,
  message: string,
  context?: unknown,
): Promise<void> {
  if (typeof window === 'undefined') return // no-op on server
  if (!withinRateLimit()) return
  try {
    const serialized = context !== undefined ? serializeValue(context) : null
    await addDoc(collection(db, 'system_logs'), {
      level,
      message,
      context: serialized,
      userId: auth.currentUser?.uid ?? null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof location !== 'undefined' ? location.href : '',
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      createdAt: serverTimestamp(),
    })
  } catch {
    /* swallow — never let logging failures escape */
  }
}

/** Read recent logs for the in-app viewer. Requires admin/owner permission via rules. */
export async function fetchRecentLogs(maxCount = 100): Promise<SystemLog[]> {
  const q = query(collection(db, 'system_logs'), orderBy('createdAt', 'desc'), limit(maxCount))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SystemLog, 'id'>) }))
}

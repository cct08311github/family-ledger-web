import { collection, getDocs } from 'firebase/firestore'
import { deleteObject, getMetadata, listAll, ref as storageRef } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { logger } from '@/lib/logger'

export interface OrphanFile {
  /** Full storage path, e.g. receipts/g1/e1/123-0-uuid.jpg */
  path: string
  /** Derived from path segment; empty string if malformed */
  expenseId: string
  /** Bytes */
  size: number
  /** Storage object creation time (ISO string) */
  timeCreated: string
}

export interface DeleteOrphansResult {
  succeeded: string[]
  failed: { path: string; error: unknown }[]
}

/**
 * Fetch every receipt path referenced by a group's expenses (new `receiptPaths` +
 * legacy singular `receiptPath`). Returned as a Set for O(1) membership checks.
 */
async function collectReferencedPaths(groupId: string): Promise<Set<string>> {
  const snap = await getDocs(collection(db, 'groups', groupId, 'expenses'))
  const paths = new Set<string>()
  for (const d of snap.docs) {
    const data = d.data() as { receiptPaths?: string[]; receiptPath?: string | null }
    if (Array.isArray(data.receiptPaths)) {
      for (const p of data.receiptPaths) {
        if (typeof p === 'string' && p.length > 0) paths.add(p)
      }
    }
    if (typeof data.receiptPath === 'string' && data.receiptPath.length > 0) {
      paths.add(data.receiptPath)
    }
  }
  return paths
}

/**
 * Recursively walk all items under receipts/{groupId}/ in Storage.
 * Firebase Storage listAll() follows sub-prefixes automatically when called on
 * the parent, but Firebase JS SDK returns one level at a time — so we recurse.
 */
async function listAllReceipts(groupId: string): Promise<string[]> {
  const paths: string[] = []
  const root = storageRef(storage, `receipts/${groupId}`)
  const rootList = await listAll(root)
  for (const item of rootList.items) paths.push(item.fullPath)
  for (const prefix of rootList.prefixes) {
    const sub = await listAll(prefix)
    for (const item of sub.items) paths.push(item.fullPath)
    // Receipts use exactly 2 levels (groupId/expenseId/file), so no deeper recursion needed.
  }
  return paths
}

/** Extract `{expenseId}` from `receipts/{groupId}/{expenseId}/{fileName}`. */
function parseExpenseId(path: string): string {
  const parts = path.split('/')
  return parts.length >= 3 ? parts[2] : ''
}

/**
 * Compare all Storage objects under receipts/{groupId}/ against paths referenced
 * by Firestore expense docs. Any Storage path NOT referenced is an orphan.
 *
 * Caller must be group owner (enforced by storage.rules `allow list`).
 */
export async function scanOrphans(groupId: string): Promise<OrphanFile[]> {
  const [storagePaths, referenced] = await Promise.all([
    listAllReceipts(groupId),
    collectReferencedPaths(groupId),
  ])
  const orphanPaths = storagePaths.filter((p) => !referenced.has(p))
  // Parallel metadata fetch; tolerate individual failures (e.g. object deleted
  // mid-scan) by filtering them out.
  const results = await Promise.allSettled(
    orphanPaths.map(async (path): Promise<OrphanFile> => {
      const meta = await getMetadata(storageRef(storage, path))
      return {
        path,
        expenseId: parseExpenseId(path),
        size: meta.size ?? 0,
        timeCreated: meta.timeCreated ?? '',
      }
    }),
  )
  const orphans: OrphanFile[] = []
  for (const [i, r] of results.entries()) {
    if (r.status === 'fulfilled') {
      orphans.push(r.value)
    } else {
      logger.warn('[orphan-scanner] getMetadata failed, skipping', {
        path: orphanPaths[i],
        err: r.reason,
      })
    }
  }
  // Oldest first — helps users focus on stale accumulations.
  orphans.sort((a, b) => a.timeCreated.localeCompare(b.timeCreated))
  return orphans
}

/**
 * Delete the given storage paths. Best-effort: each deletion is independent,
 * failures are collected rather than aborting the batch.
 */
export async function deleteOrphans(paths: string[]): Promise<DeleteOrphansResult> {
  const results = await Promise.allSettled(
    paths.map((p) => deleteObject(storageRef(storage, p))),
  )
  const succeeded: string[] = []
  const failed: { path: string; error: unknown }[] = []
  for (const [i, r] of results.entries()) {
    if (r.status === 'fulfilled') {
      succeeded.push(paths[i])
    } else {
      failed.push({ path: paths[i], error: r.reason })
    }
  }
  if (failed.length > 0) {
    logger.error('[orphan-scanner] Some deletions failed', {
      totalRequested: paths.length,
      failed: failed.length,
    })
  }
  return { succeeded, failed }
}

/** Pure diff helper exposed for unit testing (avoids Storage SDK dependency). */
export function computeOrphanPaths(
  storagePaths: readonly string[],
  referencedPaths: ReadonlySet<string>,
): string[] {
  return storagePaths.filter((p) => !referencedPaths.has(p))
}

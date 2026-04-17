import { ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { logger } from '@/lib/logger'

export const MAX_RECEIPTS_PER_EXPENSE = 10
export const MAX_IMAGE_DIMENSION = 1920
export const JPEG_QUALITY = 0.85
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
/** Reject pixel-bomb images (small file, huge canvas) before calling drawImage. */
export const MAX_PIXEL_COUNT = 50_000_000 // ~50 MP; 8K is ~33 MP

export interface UploadResult {
  paths: string[]
}

export class ReceiptUploadError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'ReceiptUploadError'
    this.cause = cause
  }
}

/**
 * Resize an image to fit within MAX_IMAGE_DIMENSION on the longest edge
 * and re-encode as JPEG at JPEG_QUALITY. Non-image inputs pass through untouched.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  // SVG and GIF: skip compression to preserve vector / animation
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file

  const dataUrl = await readFileAsDataURL(file)
  const img = await loadImage(dataUrl)
  const pixelCount = img.naturalWidth * img.naturalHeight
  if (pixelCount > MAX_PIXEL_COUNT) {
    throw new ReceiptUploadError(`圖片尺寸過大（${img.naturalWidth}×${img.naturalHeight}）`)
  }
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, MAX_IMAGE_DIMENSION)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ReceiptUploadError('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new ReceiptUploadError('Image compression failed')
  return blob
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new ReceiptUploadError('FileReader failed', reader.error))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ReceiptUploadError('Image decode failed'))
    img.src = src
  })
}

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h }
  const ratio = w > h ? max / w : max / h
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}

/**
 * Upload up to MAX_RECEIPTS_PER_EXPENSE images for an expense. Compresses images
 * client-side before upload. If ANY upload fails, all successfully uploaded files
 * are deleted (best-effort rollback) and a ReceiptUploadError is thrown.
 *
 * `onProgress` fires once per file after it finishes uploading — useful for
 * showing "N/M 張" feedback during slow uploads. File-granularity is intentional;
 * byte-level would require uploadBytesResumable (out of scope for #160).
 */
export async function uploadReceiptImages(
  groupId: string,
  expenseId: string,
  files: File[],
  uploadedBy: string,
  onProgress?: (_current: number, _total: number) => void,
): Promise<UploadResult> {
  if (files.length === 0) return { paths: [] }
  if (files.length > MAX_RECEIPTS_PER_EXPENSE) {
    throw new ReceiptUploadError(`最多只能上傳 ${MAX_RECEIPTS_PER_EXPENSE} 張圖片`)
  }

  const uploaded: string[] = []
  try {
    for (const [index, file] of files.entries()) {
      const blob = await compressImage(file)
      if (blob.size > MAX_UPLOAD_BYTES) {
        throw new ReceiptUploadError(`圖片 ${file.name} 超過 10MB 限制`)
      }
      const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'bin')
      const fileName = `${Date.now()}-${index}-${crypto.randomUUID()}.${ext}`
      const path = `receipts/${groupId}/${expenseId}/${fileName}`
      await uploadBytes(storageRef(storage, path), blob, {
        contentType: blob.type || file.type || 'application/octet-stream',
        customMetadata: { uploadedBy },
      })
      uploaded.push(path)
      onProgress?.(index + 1, files.length)
    }
    return { paths: uploaded }
  } catch (err) {
    await rollbackUploads(uploaded)
    // Full error (including paths, stack, Firebase code) goes to the backend log
    // so developers can diagnose without the user pasting details.
    logger.error('[image-upload] uploadReceiptImages failed', {
      groupId,
      expenseId,
      uploadedSoFar: uploaded.length,
      totalFiles: files.length,
      err,
    })
    if (err instanceof ReceiptUploadError) throw err
    // User-facing message is intentionally generic — path/bucket names and
    // internal error details are PII/security-sensitive and must not surface
    // in the UI. Full details are in system_logs.
    throw new ReceiptUploadError(friendlyErrorMessage(err), err)
  }
}

/**
 * Map low-level errors to short, non-leaking user messages.
 * The exact Firebase error code stays in backend logs — the UI only shows
 * a generic category + remediation hint.
 */
function friendlyErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code
  switch (code) {
    case 'storage/unauthorized':
      return '沒有上傳權限，請聯絡管理員'
    case 'storage/unauthenticated':
      return '登入已過期，請重新登入後再試'
    case 'storage/quota-exceeded':
      return '儲存空間已滿'
    case 'storage/retry-limit-exceeded':
    case 'storage/canceled':
      return '網路連線不穩，請稍後重試'
    case 'storage/invalid-checksum':
    case 'storage/invalid-format':
      return '圖片檔案損毀或格式不支援'
    default:
      return '圖片上傳失敗，請稍後重試'
  }
}

async function rollbackUploads(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const results = await Promise.allSettled(
    paths.map((p) => deleteObject(storageRef(storage, p))),
  )
  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length > 0) {
    logger.error('[image-upload] Rollback failed for some objects', { failed: failed.length, total: paths.length })
  }
}

/** Delete receipt objects (used when user removes existing images or deletes an expense). */
export async function deleteReceiptImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await Promise.allSettled(paths.map((p) => deleteObject(storageRef(storage, p))))
}

/** Normalize legacy `receiptPath` + new `receiptPaths` into a single array for reads. */
export function normalizeReceiptPaths(expense: { receiptPaths?: string[]; receiptPath?: string | null }): string[] {
  if (expense.receiptPaths && expense.receiptPaths.length > 0) return expense.receiptPaths
  if (expense.receiptPath) return [expense.receiptPath]
  return []
}

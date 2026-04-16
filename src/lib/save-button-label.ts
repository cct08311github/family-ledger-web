/**
 * Pure helper + type for the expense form's submit button label.
 *
 * Lives in its own module so unit tests can import without pulling in
 * `expense-form.tsx`'s Firebase transitive dependencies.
 */

export interface UploadProgress {
  current: number
  total: number
}

/**
 * Compute the submit button label from current save + upload state.
 *
 * States:
 * - idle: "新增支出" / "儲存變更"
 * - saving, no receipts: "儲存中..."
 * - saving, upload queued (total>0, current=0): "準備上傳 N 張..."
 * - saving, upload in progress (0<current<total): "上傳中 N/M 張..."
 * - saving, uploads done, Firestore write pending (current=total): "儲存中..."
 */
export function saveButtonLabel(args: {
  saving: boolean
  isEditing: boolean
  uploadProgress: UploadProgress
}): string {
  const { saving, isEditing, uploadProgress } = args
  if (!saving) return isEditing ? '儲存變更' : '新增支出'
  const { current, total } = uploadProgress
  if (total > 0) {
    if (current === 0) return `準備上傳 ${total} 張...`
    if (current < total) return `上傳中 ${current}/${total} 張...`
  }
  return '儲存中...'
}

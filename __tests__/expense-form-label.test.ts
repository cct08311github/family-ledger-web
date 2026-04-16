// Helper lives in its own module, so no Firebase mocks are needed.
import { saveButtonLabel } from '@/lib/save-button-label'

describe('saveButtonLabel', () => {
  const idle = { current: 0, total: 0 }

  it('shows "新增支出" when not saving and not editing', () => {
    expect(saveButtonLabel({ saving: false, isEditing: false, uploadProgress: idle })).toBe('新增支出')
  })

  it('shows "儲存變更" when not saving but editing', () => {
    expect(saveButtonLabel({ saving: false, isEditing: true, uploadProgress: idle })).toBe('儲存變更')
  })

  it('shows "準備上傳 N 張..." when uploads queued but no tick yet', () => {
    expect(
      saveButtonLabel({ saving: true, isEditing: false, uploadProgress: { current: 0, total: 3 } }),
    ).toBe('準備上傳 3 張...')
  })

  it('shows "上傳中 N/M 張..." when uploads partially done', () => {
    expect(
      saveButtonLabel({ saving: true, isEditing: false, uploadProgress: { current: 3, total: 10 } }),
    ).toBe('上傳中 3/10 張...')
  })

  it('shows generic "儲存中..." after uploads finish but Firestore write still pending', () => {
    expect(
      saveButtonLabel({ saving: true, isEditing: false, uploadProgress: { current: 10, total: 10 } }),
    ).toBe('儲存中...')
  })

  it('shows generic "儲存中..." when saving without any receipts', () => {
    expect(saveButtonLabel({ saving: true, isEditing: false, uploadProgress: idle })).toBe('儲存中...')
  })

  it('isEditing does not affect label while saving', () => {
    expect(
      saveButtonLabel({ saving: true, isEditing: true, uploadProgress: { current: 1, total: 2 } }),
    ).toBe('上傳中 1/2 張...')
  })
})

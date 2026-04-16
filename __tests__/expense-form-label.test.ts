// The full expense-form component pulls in Firebase and React DOM which are
// heavy and unnecessary for testing this pure helper. Mock the module's
// Firebase-adjacent imports just enough for the helper to be importable.
jest.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }))
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  Timestamp: { now: jest.fn(), fromDate: jest.fn() },
  serverTimestamp: jest.fn(),
  deleteField: jest.fn(),
  onSnapshot: jest.fn(),
}))
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  deleteObject: jest.fn(),
}))

import { saveButtonLabel } from '@/components/expense-form'

describe('saveButtonLabel', () => {
  const idle = { current: 0, total: 0 }

  it('shows "新增支出" when not saving and not editing', () => {
    expect(saveButtonLabel({ saving: false, isEditing: false, uploadProgress: idle })).toBe('新增支出')
  })

  it('shows "儲存變更" when not saving but editing', () => {
    expect(saveButtonLabel({ saving: false, isEditing: true, uploadProgress: idle })).toBe('儲存變更')
  })

  it('shows upload progress when saving and uploads in-flight', () => {
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

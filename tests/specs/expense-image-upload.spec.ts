import { test, expect } from '@playwright/test'
import { ExpenseFormPage } from '../pages/ExpenseFormPage'
import {
  createTestUser,
  signInWithEmailPassword,
  deleteTestUser,
  skipIfEmulatorUnavailable,
} from '../helpers/test-auth'

/**
 * 支出收據圖片上傳 E2E 測試 (Issue #150)
 *
 * 覆蓋範圍：
 * - 收據上傳區塊渲染
 * - 單張 / 多張圖片預覽
 * - 移除已選圖片
 * - 10 張上限（超過後「新增圖片」按鈕隱藏）
 * - 非圖片檔被過濾
 *
 * 這些測試不實際儲存支出（需 group 設定），只驗證 UI 機制 —
 * Storage 寫入已由 unit test 的 mock 驗證，rollback 行為由 service 單元測試覆蓋。
 */

test.describe('支出收據圖片上傳 (Issue #150)', () => {
  let expensePage: ExpenseFormPage
  let testUserEmail: string
  let testUserPassword: string
  let testUserUid: string

  test.beforeAll(async () => {
    if (!(await skipIfEmulatorUnavailable())) return
    testUserEmail = `receipt${Date.now()}@emulator.test`
    testUserPassword = 'testpass123'
    const user = await createTestUser(testUserEmail, testUserPassword, '收據測試使用者')
    testUserUid = user.uid
  })

  test.afterAll(async () => {
    if (testUserUid) await deleteTestUser(testUserUid)
  })

  test.beforeEach(async ({ page }) => {
    expensePage = new ExpenseFormPage(page, '/expense/new')
    await signInWithEmailPassword(page, testUserEmail, testUserPassword)
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')
  })

  test('TC-IMG-001: 收據上傳區塊預設顯示空狀態與新增按鈕', async () => {
    await expect(expensePage.receiptSectionLabel).toBeVisible()
    await expect(expensePage.receiptAddButton).toBeVisible()
    await expect(expensePage.receiptThumbs).toHaveCount(0)
    await expect(expensePage.receiptSectionLabel).toContainText('0/10')
  })

  test('TC-IMG-002: 選取單張圖片後顯示縮圖與計數', async () => {
    await expensePage.attachReceiptFiles(1)
    await expect(expensePage.receiptThumbs).toHaveCount(1)
    await expect(expensePage.receiptSectionLabel).toContainText('1/10')
    await expect(expensePage.receiptRemoveButtons).toHaveCount(1)
  })

  test('TC-IMG-003: 選取三張圖片後顯示三個縮圖', async () => {
    await expensePage.attachReceiptFiles(3)
    await expect(expensePage.receiptThumbs).toHaveCount(3)
    await expect(expensePage.receiptSectionLabel).toContainText('3/10')
  })

  test('TC-IMG-004: 可移除已選圖片，計數正確更新', async () => {
    await expensePage.attachReceiptFiles(3)
    await expect(expensePage.receiptThumbs).toHaveCount(3)

    await expensePage.removeReceiptAt(1)
    await expect(expensePage.receiptThumbs).toHaveCount(2)
    await expect(expensePage.receiptSectionLabel).toContainText('2/10')

    await expensePage.removeReceiptAt(0)
    await expect(expensePage.receiptThumbs).toHaveCount(1)

    await expensePage.removeReceiptAt(0)
    await expect(expensePage.receiptThumbs).toHaveCount(0)
    await expect(expensePage.receiptAddButton).toBeVisible()
  })

  test('TC-IMG-005: 達到 10 張上限後「新增圖片」按鈕隱藏', async () => {
    await expensePage.attachReceiptFiles(10)
    await expect(expensePage.receiptThumbs).toHaveCount(10)
    await expect(expensePage.receiptSectionLabel).toContainText('10/10')
    await expect(expensePage.receiptAddButton).toHaveCount(0)
  })

  test('TC-IMG-006: 移除一張後「新增圖片」按鈕重新出現', async () => {
    await expensePage.attachReceiptFiles(10)
    await expect(expensePage.receiptAddButton).toHaveCount(0)

    await expensePage.removeReceiptAt(0)
    await expect(expensePage.receiptThumbs).toHaveCount(9)
    await expect(expensePage.receiptAddButton).toBeVisible()
    await expect(expensePage.receiptSectionLabel).toContainText('9/10')
  })

  test('TC-IMG-007: 分批選取累加（先 4 張再 3 張應合計 7 張）', async () => {
    await expensePage.attachReceiptFiles(4)
    await expect(expensePage.receiptThumbs).toHaveCount(4)

    await expensePage.attachReceiptFiles(3)
    await expect(expensePage.receiptThumbs).toHaveCount(7)
    await expect(expensePage.receiptSectionLabel).toContainText('7/10')
  })
})

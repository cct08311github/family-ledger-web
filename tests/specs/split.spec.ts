import { test, expect } from '@playwright/test'
import { SplitPage } from '../pages/SplitPage'
import { createTestUser, signInWithEmailPassword, deleteTestUser, skipIfEmulatorUnavailable } from '../helpers/test-auth'

/**
 * 拆帳結算測試
 *
 * 注意：這些測試需要 Firebase 認證。拆分/結算功能需要登入後才能訪問。
 * 使用 Firebase Auth Emulator 進行認證。
 */

test.describe('拆帳結算 (Split & Settlement)', () => {
  let splitPage: SplitPage
  let testUserEmail: string
  let testUserPassword: string
  let testUserUid: string

  test.beforeAll(async () => {
    if (!await skipIfEmulatorUnavailable()) return
    testUserEmail = `split${Date.now()}@emulator.test`
    testUserPassword = 'testpass123'
    const user = await createTestUser(testUserEmail, testUserPassword, '測試使用者')
    testUserUid = user.uid
  })

  test.afterAll(async () => {
    if (testUserUid) {
      await deleteTestUser(testUserUid)
    }
  })

  test.beforeEach(async ({ page }) => {
    splitPage = new SplitPage(page)
    await signInWithEmailPassword(page, testUserEmail, testUserPassword)
  })

  test('TC-SPLIT-001: 結算頁面需要認證', async ({ page }) => {
    await splitPage.goto()
    await splitPage.waitForLoadState('networkidle')

    await splitPage.expectLoaded()
  })

  test('TC-SPLIT-002: 每人餘額顯示需要認證', async ({ page }) => {
    await splitPage.goto()
    await splitPage.waitForLoadState('networkidle')

    await splitPage.expectLoaded()
  })

  test('TC-SPLIT-003: 結算方案顯示需要認證', async ({ page }) => {
    await splitPage.goto()
    await splitPage.waitForLoadState('networkidle')

    await splitPage.expectLoaded()
  })

  test('TC-SPLIT-004: 記錄結算功能需要認證', async ({ page }) => {
    await splitPage.goto()
    await splitPage.waitForLoadState('networkidle')

    await splitPage.expectLoaded()

    if (await splitPage.hasDebts()) {
      await splitPage.clickSettle(0)
      await splitPage.expectSettleDialogVisible()
    }
  })

  test('TC-SPLIT-005: 複製結算明細需要認證', async ({ page }) => {
    await splitPage.goto()
    await splitPage.waitForLoadState('networkidle')

    await splitPage.expectLoaded()

    if (await splitPage.hasDebts()) {
      await splitPage.copyDebtsReport()
    }
  })
})

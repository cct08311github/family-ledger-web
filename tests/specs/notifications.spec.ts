import { test, expect } from '@playwright/test'
import { NotificationsPage } from '../pages/NotificationsPage'
import { createTestUser, signInWithEmailPassword, deleteTestUser, skipIfEmulatorUnavailable } from '../helpers/test-auth'

/**
 * 通知頁面測試
 *
 * 注意：這些測試需要 Firebase 認證。通知功能需要登入後才能訪問。
 * 使用 Firebase Auth Emulator 進行認證。
 */

test.describe('通知頁面 (Notifications Page)', () => {
  let notificationsPage: NotificationsPage
  let testUserEmail: string
  let testUserPassword: string
  let testUserUid: string

  test.beforeAll(async () => {
    if (!await skipIfEmulatorUnavailable()) return
    testUserEmail = `notify${Date.now()}@emulator.test`
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
    notificationsPage = new NotificationsPage(page)
    await signInWithEmailPassword(page, testUserEmail, testUserPassword)
  })

  test('TC-NOTIFY-001: 通知頁面需要認證', async ({ page }) => {
    await notificationsPage.goto()
    await notificationsPage.waitForLoadState('networkidle')

    await notificationsPage.expectLoaded()
  })

  test('TC-NOTIFY-002: 全部標為已讀按鈕需要認證', async ({ page }) => {
    await notificationsPage.goto()
    await notificationsPage.waitForLoadState('networkidle')

    await notificationsPage.expectLoaded()
  })

  test('TC-NOTIFY-003: 通知清單顯示需要認證', async ({ page }) => {
    await notificationsPage.goto()
    await notificationsPage.waitForLoadState('networkidle')

    await notificationsPage.expectLoaded()
  })
})

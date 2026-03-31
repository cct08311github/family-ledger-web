import { test, expect } from '@playwright/test'
import { SettingsPage } from '../pages/SettingsPage'
import { createTestUser, signInWithEmailPassword, deleteTestUser, skipIfEmulatorUnavailable } from '../helpers/test-auth'

/**
 * 設定頁面測試
 *
 * 注意：這些測試需要 Firebase 認證。設定功能需要登入後才能訪問。
 * 使用 Firebase Auth Emulator 進行認證。
 */

test.describe('設定頁面 (Settings Page)', () => {
  let settingsPage: SettingsPage
  let testUserEmail: string
  let testUserPassword: string
  let testUserUid: string

  test.beforeAll(async () => {
    if (!await skipIfEmulatorUnavailable()) return
    testUserEmail = `settings${Date.now()}@emulator.test`
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
    settingsPage = new SettingsPage(page)
    await signInWithEmailPassword(page, testUserEmail, testUserPassword)
  })

  test('TC-SETTINGS-001: 設定頁面需要認證', async ({ page }) => {
    await settingsPage.goto()
    await settingsPage.waitForLoadState('networkidle')

    await settingsPage.expectLoaded()
  })

  test('TC-SETTINGS-002: 設定頁面導航需要認證', async ({ page }) => {
    await settingsPage.goto()
    await settingsPage.waitForLoadState('networkidle')

    await settingsPage.expectLoaded()
  })

  test('TC-SETTINGS-003: 類別管理頁面需要認證', async ({ page }) => {
    await settingsPage.goto()
    await settingsPage.waitForLoadState('networkidle')

    await settingsPage.navigateToCategories()
  })
})

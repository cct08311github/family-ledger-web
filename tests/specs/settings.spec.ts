import { test, expect } from '@playwright/test'
import { SettingsPage } from '../pages/SettingsPage'

/**
 * 設定頁面測試
 *
 * 注意：這些測試需要 Firebase 認證。設定功能需要登入後才能訪問。
 */

test.describe('設定頁面 (Settings Page)', () => {
  test.skip('TC-SETTINGS-001: 設定頁面需要認證', async ({ page }) => {
    const settingsPage = new SettingsPage(page)
    await settingsPage.goto()
    await settingsPage.waitForLoadState('networkidle')

    await settingsPage.expectLoaded()
  })

  test.skip('TC-SETTINGS-002: 設定頁面導航需要認證', async ({ page }) => {
    const settingsPage = new SettingsPage(page)
    await settingsPage.goto()
    await settingsPage.waitForLoadState('networkidle')

    await settingsPage.expectLoaded()
  })

  test.skip('TC-SETTINGS-003: 類別管理頁面需要認證', async ({ page }) => {
    const settingsPage = new SettingsPage(page)
    await settingsPage.goto()
    await settingsPage.waitForLoadState('networkidle')

    await settingsPage.navigateToCategories()
  })
})

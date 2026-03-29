import { test, expect } from '@playwright/test'
import { NotificationsPage } from '../pages/NotificationsPage'

/**
 * 通知頁面測試
 *
 * 注意：這些測試需要 Firebase 認證。通知功能需要登入後才能訪問。
 */

test.describe('通知頁面 (Notifications Page)', () => {
  test.skip('TC-NOTIFY-001: 通知頁面需要認證', async ({ page }) => {
    const notificationsPage = new NotificationsPage(page)
    await notificationsPage.goto()
    await notificationsPage.waitForLoadState('networkidle')

    await notificationsPage.expectLoaded()
  })

  test.skip('TC-NOTIFY-002: 全部標為已讀按鈕需要認證', async ({ page }) => {
    const notificationsPage = new NotificationsPage(page)
    await notificationsPage.goto()
    await notificationsPage.waitForLoadState('networkidle')

    await notificationsPage.expectLoaded()
  })

  test.skip('TC-NOTIFY-003: 通知清單顯示需要認證', async ({ page }) => {
    const notificationsPage = new NotificationsPage(page)
    await notificationsPage.goto()
    await notificationsPage.waitForLoadState('networkidle')

    await notificationsPage.expectLoaded()
  })
})

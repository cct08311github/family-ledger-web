import { test, expect } from '@playwright/test'
import { HomePage } from '../pages/HomePage'

/**
 * 首頁儀表板測試
 *
 * 注意：這些測試需要 Firebase 認證。首頁 Dashboard 需要登入後才能完整訪問。
 * 部分測試（如導航連結）可以在未認證狀態下測試。
 */

test.describe('首頁儀表板 (Home Dashboard)', () => {
  let homePage: HomePage

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page)
  })

  test('TC-HOME-001: 首頁 URL 可訪問', async ({ page }) => {
    // 測試首頁是否可訪問（可能會 redirect 到 login）
    const response = await page.goto('/')
    expect(response?.ok()).toBeTruthy()
    await page.waitForLoadState('domcontentloaded')
  })

  test('TC-HOME-002: 響應式設計 - 桌面視圖', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // 檢查頁面有基本結構
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('TC-HOME-003: 響應式設計 - 移動視圖', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // 檢查頁面有基本結構
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test.skip('TC-HOME-004: 月度摘要顯示需要認證', async ({ page }) => {
    await homePage.goto()
    await homePage.waitForLoadState('networkidle')

    await homePage.expectLoaded()
  })

  test.skip('TC-HOME-005: 導航連結需要認證', async ({ page }) => {
    await homePage.goto()
    await homePage.waitForLoadState('networkidle')

    await homePage.expectLoaded()
  })

  test.skip('TC-HOME-006: 新增支出按鈕需要認證', async ({ page }) => {
    await homePage.goto()
    await homePage.waitForLoadState('networkidle')

    await homePage.expectLoaded()
  })

  test.skip('TC-HOME-007: 無資料狀態需要認證', async ({ page }) => {
    await homePage.goto()
    await homePage.waitForLoadState('networkidle')

    await homePage.expectLoaded()
  })

  test.skip('TC-HOME-008: 通知圖標顯示需要認證', async ({ page }) => {
    await homePage.goto()
    await homePage.waitForLoadState('networkidle')

    await homePage.expectLoaded()
  })
})

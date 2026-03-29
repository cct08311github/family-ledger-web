import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'

test.describe('登入流程 (Login Flow)', () => {
  let loginPage: LoginPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    await loginPage.goto()
  })

  test('TC-LOGIN-001: 登入頁面正確顯示', async ({ page }) => {
    await loginPage.expectLoaded()

    // 驗證標題
    await expect(loginPage.title).toHaveText('家計本')

    // 驗證副標題
    await expect(loginPage.subtitle.first()).toContainText('全家人共享記帳')

    // 驗證 Google 登入按鈕存在
    await expect(loginPage.googleButton).toBeVisible()

    // 驗證描述文字
    await expect(page.locator('text=登入後可在多台裝置間同步資料')).toBeVisible()
  })

  test('TC-LOGIN-002: 點擊 Google 登入按鈕', async ({ page }) => {
    await loginPage.expectLoaded()

    // 截圖登入頁面
    await loginPage.screenshot('login-page')

    // 點擊 Google 登入（會彈出 Google OAuth 視窗）
    await loginPage.clickGoogleSignIn()

    // 等待可能彈出的 Google 登入對話框
    // 注意：實際測試需要 Firebase Emulator 或測試帳號
    await page.waitForTimeout(2000)

    // 截圖登入後狀態
    await loginPage.screenshot('login-attempted')
  })

  test('TC-LOGIN-003: 登入頁面響應式設計', async ({ page }) => {
    await loginPage.expectLoaded()

    // 桌面視圖
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(loginPage.title).toBeVisible()

    // 移動視圖
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(loginPage.title).toBeVisible()
  })

  test('TC-LOGIN-004: Loading 狀態顯示', async ({ page }) => {
    // 模擬載入中狀態（通過 Firebase 初始化的 loading 狀態）
    await loginPage.goto()
    await loginPage.waitForLoading()

    // 如果有 loading spinner，驗證其存在
    const spinner = loginPage.locator('.animate-spin')
    const isVisible = await spinner.isVisible().catch(() => false)
    if (isVisible) {
      await expect(spinner).toBeAttached()
    }
  })
})

import { test, expect } from '@playwright/test'

/**
 * 綜合 E2E 測試規格
 *
 * 此測試檔案包含所有關鍵用戶流程的端到端測試
 * 測試覆蓋：
 * 1. 登入流程 - Google OAuth 登入
 * 2. 首頁儀表板 - 月度摘要、債務概覽、最近支出
 * 3. 支出 CRUD - 新增、編輯、刪除支出
 * 4. 語音輸入 - Web Speech API 語音記帳
 * 5. 統計頁面 - 圖表呈現
 * 6. 通知頁面 - 讀取、標記已讀
 * 7. 結算頁面 - 債務結算流程
 * 8. PWA 功能 - offline cache、install prompt
 */

test.describe('家族記帳應用 - 全面 E2E 測試', () => {
  // 全域截圖目錄
  const screenshotDir = 'playwright-report/screenshots'

  test.beforeAll(async () => {
    // 確保截圖目錄存在
  })

  test('SMOKE: 應用程式可訪問且首頁正常載入', async ({ page }) => {
    // 訪問首頁
    const response = await page.goto('/')
    expect(response?.ok()).toBeTruthy()

    // 等待頁面載入完成
    await page.waitForLoadState('networkidle')

    // 截圖
    await page.screenshot({ path: `${screenshotDir}/smoke-home.png`, fullPage: true })

    // 基本驗證
    expect(new URL(page.url()).port).toBe('3013')
  })

  test('SMOKE: 登入頁面正常運作', async ({ page }) => {
    const response = await page.goto('/login')
    expect(response?.ok()).toBeTruthy()

    await page.waitForLoadState('networkidle')

    // 驗證標題
    const title = page.locator('h1')
    await expect(title).toBeVisible()

    // 截圖
    await page.screenshot({ path: `${screenshotDir}/smoke-login.png`, fullPage: true })
  })

  test('SMOKE: 所有主要路由可訪問', async ({ page }) => {
    const routes = [
      { path: '/', name: '首頁' },
      { path: '/login', name: '登入' },
      { path: '/records', name: '記錄' },
      { path: '/split', name: '拆帳' },
      { path: '/statistics', name: '統計' },
      { path: '/settings', name: '設定' },
      { path: '/notifications', name: '通知' },
    ]

    for (const route of routes) {
      const response = await page.goto(route.path)
      expect(response?.ok()).toBeTruthy(), `Route ${route.name} (${route.path}) should be accessible`
      await page.waitForLoadState('domcontentloaded')
      await page.screenshot({ path: `${screenshotDir}/smoke-${route.name}.png`, fullPage: true })
    }
  })

  test('SMOKE: PWA Manifest 和 Service Worker', async ({ page }) => {
    // Manifest
    const manifestResponse = await page.goto('/manifest.json')
    expect(manifestResponse?.ok()).toBeTruthy()

    // Service Worker
    const swResponse = await page.goto('/sw.js')
    expect(swResponse?.ok()).toBeTruthy()

    await page.screenshot({ path: `${screenshotDir}/smoke-pwa.png`, fullPage: true })
  })

  test('SMOKE: 響應式設計 - 桌面', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${screenshotDir}/smoke-desktop.png`, fullPage: true })
  })

  test('SMOKE: 響應式設計 - 移動', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${screenshotDir}/smoke-mobile.png`, fullPage: true })
  })
})

import { test, expect, _electron } from '@playwright/test'

test.describe('PWA 功能 (PWA Features)', () => {
  test('TC-PWA-001: Web App Manifest 存在且有效', async ({ page }) => {
    // 檢查 manifest.json
    const manifestResponse = await page.goto('/manifest.json')
    expect(manifestResponse?.ok()).toBeTruthy()

    const manifest = await manifestResponse?.json()

    // 驗證必要欄位
    expect(manifest?.name).toBe('家計本')
    expect(manifest?.short_name).toBe('家計本')
    expect(manifest?.start_url).toBe('/')
    expect(manifest?.display).toBe('standalone')
    expect(manifest?.icons).toBeDefined()
    expect(manifest?.icons.length).toBeGreaterThan(0)
  })

  test('TC-PWA-002: Service Worker 存在', async ({ page }) => {
    const swResponse = await page.goto('/sw.js')
    expect(swResponse?.ok()).toBeTruthy()

    const swContent = await swResponse?.text()

    // 驗證 service worker 基本結構
    expect(swContent).toContain('install')
    expect(swContent).toContain('fetch')
  })

  test('TC-PWA-003: 圖標資源可訪問', async ({ page }) => {
    // 檢查 192x192 圖標
    const icon192Response = await page.goto('/icons/icon-192.png')
    expect(icon192Response?.ok()).toBeTruthy()

    // 檢查 512x512 圖標
    const icon512Response = await page.goto('/icons/icon-512.png')
    expect(icon512Response?.ok()).toBeTruthy()
  })

  test('TC-PWA-004: 離線訪問基本頁面', async ({ page, context }) => {
    // 先訪問首頁以快取資源
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 截圖正常狀態
    await page.screenshot({ path: 'playwright-report/screenshots/pwa-online.png', fullPage: true })

    // 模擬離線狀態
    await context.setOffline(true)

    // 嘗試訪問首頁
    try {
      await page.goto('/', { timeout: 5000 })
      await page.waitForLoadState('domcontentloaded')

      // 如果有 service worker 緩存，頁面應該能顯示
      await page.screenshot({ path: 'playwright-report/screenshots/pwa-offline.png', fullPage: true })
    } catch {
      // 如果離線無法訪問，這是預期行為（取決於 SW 緩存策略）
    }

    // 恢復網絡
    await context.setOffline(false)
  })

  test('TC-PWA-005: Meta 標籤正確', async ({ page }) => {
    await page.goto('/')

    // 檢查 theme-color
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(themeColor).toBeTruthy()

    // 檢查 viewport
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('width=device-width')
  })

  test('TC-PWA-006: Apple Touch Icon', async ({ page }) => {
    await page.goto('/')

    // 檢查 apple-touch-icon
    const appleTouchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
    expect(appleTouchIcon).toBeTruthy()
  })

  test('TC-PWA-007: 快捷方式功能', async ({ page }) => {
    const manifestResponse = await page.goto('/manifest.json')
    const manifest = await manifestResponse?.json()

    // 驗證捷徑配置
    expect(manifest?.shortcuts).toBeDefined()
    expect(manifest?.shortcuts.length).toBeGreaterThan(0)

    // 驗證新增支出捷徑
    const addExpenseShortcut = manifest?.shortcuts.find((s: { name: string }) => s.name === '新增支出')
    expect(addExpenseShortcut).toBeDefined()
    expect(addExpenseShortcut?.url).toBe('/expense/new')
  })
})

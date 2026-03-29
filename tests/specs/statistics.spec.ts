import { test, expect } from '@playwright/test'
import { StatisticsPage } from '../pages/StatisticsPage'

/**
 * 統計頁面測試
 *
 * 注意：這些測試需要 Firebase 認證。統計功能需要登入後才能訪問。
 */

test.describe('統計頁面 (Statistics Page)', () => {
  test.skip('TC-STATS-001: 統計頁面需要認證', async ({ page }) => {
    const statisticsPage = new StatisticsPage(page)
    await statisticsPage.goto()
    await statisticsPage.waitForLoadState('networkidle')

    await statisticsPage.expectLoaded()
  })

  test.skip('TC-STATS-002: 月分選擇器功能需要認證', async ({ page }) => {
    const statisticsPage = new StatisticsPage(page)
    await statisticsPage.goto()
    await statisticsPage.waitForLoadState('networkidle')

    await statisticsPage.expectLoaded()
  })

  test.skip('TC-STATS-003: 摘要卡片顯示需要認證', async ({ page }) => {
    const statisticsPage = new StatisticsPage(page)
    await statisticsPage.goto()
    await statisticsPage.waitForLoadState('networkidle')

    await statisticsPage.expectLoaded()
  })

  test.skip('TC-STATS-004: 圖表顯示需要認證', async ({ page }) => {
    const statisticsPage = new StatisticsPage(page)
    await statisticsPage.goto()
    await statisticsPage.waitForLoadState('networkidle')

    await statisticsPage.expectLoaded()
  })
})

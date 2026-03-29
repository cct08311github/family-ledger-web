import { test, expect } from '@playwright/test'
import { SplitPage } from '../pages/SplitPage'

/**
 * 拆帳結算測試
 *
 * 注意：這些測試需要 Firebase 認證。拆分/結算功能需要登入後才能訪問。
 */

test.describe('拆帳結算 (Split & Settlement)', () => {
  test.skip('TC-SPLIT-001: 結算頁面需要認證', async ({ page }) => {
    const splitPage = new SplitPage(page)
    await splitPage.goto()
    await splitPage.waitForLoadState('networkidle')

    await splitPage.expectLoaded()
  })

  test.skip('TC-SPLIT-002: 每人餘額顯示需要認證', async ({ page }) => {
    const splitPage = new SplitPage(page)
    await splitPage.goto()
    await splitPage.waitForLoadState('networkidle')

    await splitPage.expectLoaded()
  })

  test.skip('TC-SPLIT-003: 結算方案顯示需要認證', async ({ page }) => {
    const splitPage = new SplitPage(page)
    await splitPage.goto()
    await splitPage.waitForLoadState('networkidle')

    await splitPage.expectLoaded()
  })

  test.skip('TC-SPLIT-004: 記錄結算功能需要認證', async ({ page }) => {
    const splitPage = new SplitPage(page)
    await splitPage.goto()
    await splitPage.waitForLoadState('networkidle')

    await splitPage.expectLoaded()

    if (await splitPage.hasDebts()) {
      await splitPage.clickSettle(0)
      await splitPage.expectSettleDialogVisible()
    }
  })

  test.skip('TC-SPLIT-005: 複製結算明細需要認證', async ({ page }) => {
    const splitPage = new SplitPage(page)
    await splitPage.goto()
    await splitPage.waitForLoadState('networkidle')

    await splitPage.expectLoaded()

    if (await splitPage.hasDebts()) {
      await splitPage.copyDebtsReport()
    }
  })
})

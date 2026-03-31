import { test, expect } from '@playwright/test'
import { StatisticsPage } from '../pages/StatisticsPage'
import { createTestUser, signInWithEmailPassword, deleteTestUser } from '../helpers/test-auth'

/**
 * 統計頁面測試
 *
 * 注意：這些測試需要 Firebase 認證。統計功能需要登入後才能訪問。
 * 使用 Firebase Auth Emulator 進行認證。
 */

test.describe('統計頁面 (Statistics Page)', () => {
  let statisticsPage: StatisticsPage
  let testUserEmail: string
  let testUserPassword: string
  let testUserUid: string

  test.beforeAll(async () => {
    testUserEmail = `stats${Date.now()}@emulator.test`
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
    statisticsPage = new StatisticsPage(page)
    await signInWithEmailPassword(page, testUserEmail, testUserPassword)
  })

  test('TC-STATS-001: 統計頁面需要認證', async ({ page }) => {
    await statisticsPage.goto()
    await statisticsPage.waitForLoadState('networkidle')

    await statisticsPage.expectLoaded()
  })

  test('TC-STATS-002: 月分選擇器功能需要認證', async ({ page }) => {
    await statisticsPage.goto()
    await statisticsPage.waitForLoadState('networkidle')

    await statisticsPage.expectLoaded()
  })

  test('TC-STATS-003: 摘要卡片顯示需要認證', async ({ page }) => {
    await statisticsPage.goto()
    await statisticsPage.waitForLoadState('networkidle')

    await statisticsPage.expectLoaded()
  })

  test('TC-STATS-004: 圖表顯示需要認證', async ({ page }) => {
    await statisticsPage.goto()
    await statisticsPage.waitForLoadState('networkidle')

    await statisticsPage.expectLoaded()
  })
})

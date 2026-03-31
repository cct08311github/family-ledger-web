import { test, expect } from '@playwright/test'
import { createTestUser, signInWithEmailPassword, deleteTestUser, skipIfEmulatorUnavailable } from '../helpers/test-auth'

/**
 * 語音輸入測試
 *
 * 注意：這些測試需要 Firebase 認證。語音輸入功能需要登入後才能訪問。
 * 另外，Web Speech API 的麥克風權限在自動化環境中可能不可用。
 * 使用 Firebase Auth Emulator 進行認證。
 */

test.describe('語音輸入 (Voice Input)', () => {
  let testUserEmail: string
  let testUserPassword: string
  let testUserUid: string

  test.beforeAll(async () => {
    if (!await skipIfEmulatorUnavailable()) return
    testUserEmail = `voice${Date.now()}@emulator.test`
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
    await signInWithEmailPassword(page, testUserEmail, testUserPassword)
  })

  test('TC-VOICE-001: 語音輸入按鈕需要認證', async ({ page }) => {
    await page.goto('/expense/new')
    await page.waitForLoadState('networkidle')

    const voiceButton = page.locator('button[title*="語音"], button:has-text("🎤")')
    await expect(voiceButton).toBeVisible()
  })

  test('TC-VOICE-002: 語音按鈕可點擊需要認證', async ({ page }) => {
    await page.goto('/expense/new')
    await page.waitForLoadState('networkidle')

    const voiceButton = page.locator('button[title*="語音"], button:has-text("🎤")').first()
    await voiceButton.click()
  })

  test('TC-VOICE-003: 描述自動完成需要認證', async ({ page }) => {
    await page.goto('/expense/new')
    await page.waitForLoadState('networkidle')

    const descInput = page.locator('input[placeholder*="晚餐"]')
    await descInput.click()
    await descInput.fill('測試')
  })

  test('TC-VOICE-004: 語音 API 可用性檢測需要認證', async ({ page }) => {
    await page.goto('/expense/new')
    await page.waitForLoadState('networkidle')

    const speechApiAvailable = await page.evaluate(() => {
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    })
    console.log('Speech API available:', speechApiAvailable)
  })
})

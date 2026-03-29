import { test, expect } from '@playwright/test'

/**
 * 語音輸入測試
 *
 * 注意：這些測試需要 Firebase 認證。語音輸入功能需要登入後才能訪問。
 * 另外，Web Speech API 的麥克風權限在自動化環境中可能不可用。
 */

test.describe('語音輸入 (Voice Input)', () => {
  test.skip('TC-VOICE-001: 語音輸入按鈕需要認證', async ({ page }) => {
    await page.goto('/expense/new')
    await page.waitForLoadState('networkidle')

    const voiceButton = page.locator('button[title*="語音"], button:has-text("🎤")')
    await expect(voiceButton).toBeVisible()
  })

  test.skip('TC-VOICE-002: 語音按鈕可點擊需要認證', async ({ page }) => {
    await page.goto('/expense/new')
    await page.waitForLoadState('networkidle')

    const voiceButton = page.locator('button[title*="語音"], button:has-text("🎤")').first()
    await voiceButton.click()
  })

  test.skip('TC-VOICE-003: 描述自動完成需要認證', async ({ page }) => {
    await page.goto('/expense/new')
    await page.waitForLoadState('networkidle')

    const descInput = page.locator('input[placeholder*="晚餐"]')
    await descInput.click()
    await descInput.fill('測試')
  })

  test.skip('TC-VOICE-004: 語音 API 可用性檢測需要認證', async ({ page }) => {
    await page.goto('/expense/new')
    await page.waitForLoadState('networkidle')

    const speechApiAvailable = await page.evaluate(() => {
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    })
    console.log('Speech API available:', speechApiAvailable)
  })
})

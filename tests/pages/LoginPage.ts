import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class LoginPage extends BasePage {
  readonly title: Locator
  readonly subtitle: Locator
  readonly googleButton: Locator
  readonly loadingSpinner: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    super(page, '/login')
    this.title = this.locator('h1')
    this.subtitle = this.locator('p')
    this.googleButton = this.locator('button:has-text("Google")')
    this.loadingSpinner = this.locator('.animate-spin')
    this.errorMessage = this.locator('p:text("登入失敗")')
  }

  async expectLoaded(): Promise<void> {
    await expect(this.title).toBeVisible()
    await expect(this.title).toHaveText('家計本')
    await expect(this.googleButton).toBeVisible()
  }

  async clickGoogleSignIn(): Promise<void> {
    await this.googleButton.click()
  }

  async waitForLoading(): Promise<void> {
    await this.loadingSpinner.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  }

  async getErrorMessage(): Promise<string> {
    if (await this.errorMessage.isVisible()) {
      return this.errorMessage.textContent() ?? ''
    }
    return ''
  }
}

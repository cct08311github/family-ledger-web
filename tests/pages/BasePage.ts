import { type Page, type Locator, expect } from '@playwright/test'

// App basePath — always '/family-ledger-web' per next.config.ts
const BASE_PATH = '/family-ledger-web'

export abstract class BasePage {
  readonly page: Page
  readonly url: string

  constructor(page: Page, url: string = '') {
    this.page = page
    // Prepend basePath so page objects resolve correctly from the origin.
    this.url = `${BASE_PATH}${url}`
  }

  async goto(): Promise<void> {
    await this.page.goto(this.url)
  }

  async waitForLoadState(state: 'load' | 'networkidle' = 'load'): Promise<void> {
    await this.page.waitForLoadState(state)
  }

  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `playwright-report/screenshots/${name}.png`, fullPage: true })
  }

  protected locator(selector: string): Locator {
    return this.page.locator(selector)
  }

  protected async waitForSelector(selector: string, timeout = 10000): Promise<Locator> {
    return this.locator(selector).waitFor({ timeout })
  }

  protected async click(selector: string): Promise<void> {
    await this.locator(selector).click()
  }

  protected async fill(selector: string, value: string): Promise<void> {
    await this.locator(selector).fill(value)
  }

  protected async text(selector: string): Promise<string> {
    return this.locator(selector).textContent() ?? ''
  }

  protected async isVisible(selector: string): Promise<boolean> {
    return this.locator(selector).isVisible()
  }

  protected async assertText(selector: string, expected: string | RegExp): Promise<void> {
    await expect(this.locator(selector)).toHaveText(expected)
  }
}

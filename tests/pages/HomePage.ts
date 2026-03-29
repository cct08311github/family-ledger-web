import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class HomePage extends BasePage {
  readonly monthSection: Locator
  readonly totalAmount: Locator
  readonly sharedExpense: Locator
  readonly personalExpense: Locator
  readonly debtsSection: Locator
  readonly recentRecords: Locator
  readonly navShell: Locator
  readonly sidebar: Locator
  readonly mobileNav: Locator
  readonly addExpenseFab: Locator

  constructor(page: Page) {
    super(page, '/')
    this.monthSection = this.locator('text=月支出摘要').first()
    this.totalAmount = this.locator('.text-3xl.font-bold')
    this.sharedExpense = this.locator('text=共同支出')
    this.personalExpense = this.locator('text=個人支出')
    this.debtsSection = this.locator('text=誰欠誰')
    this.recentRecords = this.locator('text=最近記錄')
    this.navShell = this.locator('.flex.flex-col.md\\:flex-row')
    this.sidebar = this.locator('nav.hidden md\\:flex')
    this.mobileNav = this.locator('nav.md\\:hidden')
    this.addExpenseFab = this.locator('a[href="/expense/new"]')
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL('/')
    await expect(this.monthSection).toBeVisible({ timeout: 15000 })
  }

  async getTotalAmount(): Promise<string> {
    return this.totalAmount.first().textContent() ?? ''
  }

  async getDebts(): Promise<string[]> {
    const debtItems = this.locator('text=→').all()
    const count = await debtItems.length
    const debts: string[] = []
    for (let i = 0; i < count; i++) {
      const parent = (await debtItems[i].evaluateHandle('el => el.parentElement')) as unknown as Locator
      debts.push(await parent.textContent() ?? '')
    }
    return debts
  }

  async getRecentRecords(): Promise<Locator> {
    return this.recentRecords.locator('..').last()
  }

  async clickAddExpense(): Promise<void> {
    await this.addExpenseFab.first().click()
  }

  async navigateToSplit(): Promise<void> {
    await this.locator('a[href="/split"]').click()
    await expect(this.page).toHaveURL('/split')
  }

  async navigateToRecords(): Promise<void> {
    await this.locator('a[href="/records"]').click()
    await expect(this.page).toHaveURL('/records')
  }

  async navigateToStatistics(): Promise<void> {
    await this.locator('a[href="/statistics"]').click()
    await expect(this.page).toHaveURL('/statistics')
  }

  async navigateToSettings(): Promise<void> {
    await this.locator('a[href="/settings"]').click()
    await expect(this.page).toHaveURL('/settings')
  }

  async navigateToNotifications(): Promise<void> {
    await this.locator('a[href="/notifications"]').click()
    await expect(this.page).toHaveURL('/notifications')
  }
}

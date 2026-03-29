import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class RecordsPage extends BasePage {
  readonly pageTitle: Locator
  readonly filterButtons: Locator
  readonly expenseList: Locator
  readonly emptyState: Locator
  readonly expenseItems: Locator
  readonly deleteButton: Locator
  readonly editButton: Locator

  constructor(page: Page) {
    super(page, '/records')
    this.pageTitle = this.locator('h1:has-text("所有記錄")')
    this.filterButtons = this.locator('button:has-text("全部"), button:has-text("共同"), button:has-text("個人")')
    this.expenseList = this.locator('.space-y-4')
    this.emptyState = this.locator('text=沒有記錄')
    this.expenseItems = this.locator('.rounded-xl.border.border-\\[var\\(--border\\)\\].bg-\\[var\\(--card\\)\\].p-4')
    this.deleteButton = this.locator('button[title="刪除"]')
    this.editButton = this.locator('a[title="編輯"]')
  }

  async expectLoaded(): Promise<void> {
    await expect(this.pageTitle).toBeVisible({ timeout: 10000 })
  }

  async filterBy(type: '全部' | '共同' | '個人'): Promise<void> {
    await this.locator(`button:has-text("${type}")`).click()
  }

  async getExpenseCount(): Promise<number> {
    return this.expenseItems.count()
  }

  async clickEdit(expenseDescription: string): Promise<void> {
    const item = this.locator(`.group:has-text("${expenseDescription}")`)
    await item.locator('a[title="編輯"]').click()
  }

  async deleteExpense(expenseDescription: string): Promise<void> {
    const item = this.locator(`.group:has-text("${expenseDescription}")`)
    await item.locator('button[title="刪除"]').click()
    await this.page.on('dialog', dialog => dialog.accept())
  }

  async expectExpenseVisible(description: string): Promise<void> {
    await expect(this.locator(`text=${description}`).first()).toBeVisible()
  }

  async expectExpenseNotVisible(description: string): Promise<void> {
    await expect(this.locator(`text=${description}`).first()).not.toBeVisible()
  }
}

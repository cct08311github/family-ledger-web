import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class SplitPage extends BasePage {
  readonly pageTitle: Locator
  readonly balanceSection: Locator
  readonly settlementPlan: Locator
  readonly settlementHistory: Locator
  readonly settleButton: Locator
  readonly settleDialog: Locator
  readonly settleAmountInput: Locator
  readonly settleNoteInput: Locator
  readonly confirmSettleButton: Locator
  readonly cancelSettleButton: Locator
  readonly copyButton: Locator
  readonly debtCards: Locator
  readonly noDebtsMessage: Locator

  constructor(page: Page) {
    super(page, '/split')
    this.pageTitle = this.locator('text=拆帳')
    this.balanceSection = this.locator('text=每人餘額')
    this.settlementPlan = this.locator('text=結算方案')
    this.settlementHistory = this.locator('text=結算紀錄')
    this.settleButton = this.locator('button:has-text("記錄")')
    this.settleDialog = this.locator('.fixed.inset-0.z-50')
    this.settleAmountInput = this.locator('input[type="number"]').first()
    this.settleNoteInput = this.locator('input[placeholder*="Line"]')
    this.confirmSettleButton = this.locator('button:has-text("確認付款")')
    this.cancelSettleButton = this.locator('button:has-text("取消")')
    this.copyButton = this.locator('button:has-text("複製明細")')
    this.debtCards = this.locator('.rounded-xl:has(button:has-text("記錄"))')
    this.noDebtsMessage = this.locator('text=沒有未結清的債務')
  }

  async expectLoaded(): Promise<void> {
    await expect(this.balanceSection).toBeVisible({ timeout: 15000 })
  }

  async clickSettle(index = 0): Promise<void> {
    await this.settleButton.nth(index).click()
  }

  async expectSettleDialogVisible(): Promise<void> {
    await expect(this.settleDialog).toBeVisible()
    await expect(this.confirmSettleButton).toBeVisible()
  }

  async fillSettleAmount(amount: string): Promise<void> {
    await this.settleAmountInput.fill(amount)
  }

  async fillSettleNote(note: string): Promise<void> {
    await this.settleNoteInput.fill(note)
  }

  async confirmSettlement(): Promise<void> {
    await this.confirmSettleButton.click()
    await this.settleDialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  }

  async cancelSettlement(): Promise<void> {
    await this.cancelSettleButton.click()
    await this.settleDialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  }

  async copyDebtsReport(): Promise<void> {
    await this.copyButton.click()
  }

  async getDebtCount(): Promise<number> {
    return this.debtCards.count()
  }

  async hasDebts(): Promise<boolean> {
    const count = await this.getDebtCount()
    return count > 0
  }

  async getSettlementHistoryCount(): Promise<number> {
    return this.locator('text=結算紀錄').locator('..').locator('.space-y-2 > div').count()
  }
}

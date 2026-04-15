import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class ExpenseFormPage extends BasePage {
  readonly pageTitle: Locator
  readonly dateInput: Locator
  readonly descriptionInput: Locator
  readonly amountInput: Locator
  readonly categorySelect: Locator
  readonly paymentMethods: Locator
  readonly expenseTypeToggle: Locator
  readonly payerSelect: Locator
  readonly splitMethodToggle: Locator
  readonly participantButtons: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly errorMessage: Locator
  readonly voiceInputButton: Locator
  readonly splitPreview: Locator
  readonly receiptSectionLabel: Locator
  readonly receiptFileInput: Locator
  readonly receiptThumbs: Locator
  readonly receiptAddButton: Locator
  readonly receiptRemoveButtons: Locator

  constructor(page: Page, path: '/expense/new' | '/expense/[id]' = '/expense/new') {
    super(page, path)
    this.pageTitle = this.locator('h1')
    this.dateInput = this.locator('input[type="date"]')
    this.descriptionInput = this.locator('input[placeholder*="晚餐"]')
    this.amountInput = this.locator('input[type="number"]')
    this.categorySelect = this.locator('select').first()
    this.paymentMethods = this.locator('button:has-text("現金"), button:has-text("信用卡"), button:has-text("轉帳")')
    this.expenseTypeToggle = this.locator('button:has-text("個人支出"), button:has-text("共同支出")')
    this.payerSelect = this.locator('select').nth(1)
    this.splitMethodToggle = this.locator('button:has-text("均分"), button:has-text("比例"), button:has-text("自訂")')
    this.participantButtons = this.locator('button:has-text("👤"), button:has-text("👥")').filter({ hasText: /^[^\d]/ })
    this.saveButton = this.locator('button:has-text("新增支出"), button:has-text("儲存變更")')
    this.cancelButton = this.locator('button:has-text("取消")')
    this.errorMessage = this.locator('p:text-is("請填寫必要欄位")')
    this.voiceInputButton = this.locator('button[title*="語音"], button:has-text("🎤")')
    this.splitPreview = this.locator('text=拆帳預覽')
    // Receipt upload section
    this.receiptSectionLabel = this.locator('label:has-text("收據圖片")')
    this.receiptFileInput = this.locator('input[type="file"][accept="image/*"]')
    this.receiptThumbs = this.locator('div.grid img')
    this.receiptAddButton = this.locator('label:has-text("新增圖片")')
    this.receiptRemoveButtons = this.locator('button[aria-label="移除圖片"]')
  }

  /** Build a minimal valid PNG buffer (1×1 red pixel) for file upload tests. */
  static buildTestPng(): Buffer {
    // Pre-computed 1×1 red PNG (minimal valid file).
    return Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
        '1f15c4890000000d49444154789c63f8cfc0f01f0005000103b8c2c3' +
        '4b0000000049454e44ae426082',
      'hex',
    )
  }

  async attachReceiptFiles(count: number): Promise<void> {
    const files = Array.from({ length: count }, (_, i) => ({
      name: `test-receipt-${i + 1}.png`,
      mimeType: 'image/png',
      buffer: ExpenseFormPage.buildTestPng(),
    }))
    await this.receiptFileInput.setInputFiles(files)
  }

  async removeReceiptAt(index: number): Promise<void> {
    await this.receiptRemoveButtons.nth(index).click()
  }

  async expectLoaded(): Promise<void> {
    await expect(this.pageTitle).toBeVisible({ timeout: 10000 })
  }

  async fillDate(date: string): Promise<void> {
    await this.dateInput.fill(date)
  }

  async fillDescription(text: string): Promise<void> {
    await this.descriptionInput.fill(text)
  }

  async fillAmount(amount: string): Promise<void> {
    await this.amountInput.fill(amount)
  }

  async selectCategory(category: string): Promise<void> {
    await this.categorySelect.selectOption(category)
  }

  async selectPaymentMethod(method: '現金' | '信用卡' | '轉帳'): Promise<void> {
    await this.locator(`button:has-text("${method}")`).click()
  }

  async selectExpenseType(type: '個人' | '共同'): Promise<void> {
    await this.locator(`button:has-text("${type}支出")`).click()
  }

  async selectPayer(name: string): Promise<void> {
    await this.payerSelect.selectOption({ label: name })
  }

  async selectSplitMethod(method: 'equal' | 'percentage' | 'custom'): Promise<void> {
    const labels: Record<string, string> = {
      equal: '均分',
      percentage: '比例',
      custom: '自訂',
    }
    await this.locator(`button:has-text("${labels[method]}")`).click()
  }

  async toggleParticipant(name: string): Promise<void> {
    await this.locator(`button:has-text("${name}")`).click()
  }

  async fillPercentage(memberName: string, percentage: string): Promise<void> {
    const input = this.locator(`input[placeholder="%"]`).first()
    await input.fill(percentage)
  }

  async fillCustomAmount(memberName: string, amount: string): Promise<void> {
    const input = this.locator(`input[placeholder="NT$"]`).first()
    await input.fill(amount)
  }

  async clickSave(): Promise<void> {
    await this.saveButton.click()
  }

  async expectSplitPreviewVisible(): Promise<void> {
    await expect(this.splitPreview).toBeVisible()
  }

  async expectErrorMessage(text: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible()
    await expect(this.errorMessage).toHaveText(text)
  }

  async fillFullExpense(data: {
    description: string
    amount: string
    category?: string
    date?: string
    paymentMethod?: '現金' | '信用卡' | '轉帳'
    expenseType?: '個人' | '共同'
    payer?: string
    splitMethod?: 'equal' | 'percentage' | 'custom'
  }): Promise<void> {
    if (data.date) await this.fillDate(data.date)
    if (data.description) await this.fillDescription(data.description)
    if (data.amount) await this.fillAmount(data.amount)
    if (data.category) await this.selectCategory(data.category)
    if (data.paymentMethod) await this.selectPaymentMethod(data.paymentMethod)
    if (data.expenseType) await this.selectExpenseType(data.expenseType)
    if (data.payer) await this.selectPayer(data.payer)
    if (data.splitMethod) await this.selectSplitMethod(data.splitMethod)
  }
}

import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class StatisticsPage extends BasePage {
  readonly pageTitle: Locator
  readonly monthPicker: Locator
  readonly summaryCards: Locator
  readonly trendChart: Locator
  readonly categoryChart: Locator
  readonly memberChart: Locator
  readonly chartContainers: Locator

  constructor(page: Page) {
    super(page, '/statistics')
    this.pageTitle = this.locator('h1:has-text("統計")')
    this.monthPicker = this.locator('select').first()
    this.summaryCards = this.locator('.grid.grid-cols-3')
    this.trendChart = this.locator('text=月支出趨勢')
    this.categoryChart = this.locator('text=類別分布')
    this.memberChart = this.locator('text=成員分攤')
    this.chartContainers = this.locator('.recharts-wrapper')
  }

  async expectLoaded(): Promise<void> {
    await expect(this.pageTitle).toBeVisible({ timeout: 15000 })
  }

  async selectMonth(year: number, month: number): Promise<void> {
    const value = `${year}-${month - 1}`
    await this.monthPicker.selectOption(value)
  }

  async getChartCount(): Promise<number> {
    return this.chartContainers.count()
  }

  async getSummaryValues(): Promise<{ total: string; shared: string; personal: string }> {
    const cards = this.summaryCards.locator('.rounded-xl.border')
    return {
      total: await cards.nth(0).textContent() ?? '',
      shared: await cards.nth(1).textContent() ?? '',
      personal: await cards.nth(2).textContent() ?? '',
    }
  }

  async hasCharts(): Promise<boolean> {
    const count = await this.getChartCount()
    return count > 0
  }
}

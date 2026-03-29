import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class SettingsPage extends BasePage {
  readonly pageTitle: Locator
  readonly groupSection: Locator
  readonly membersSection: Locator
  readonly addMemberButton: Locator
  readonly memberInputs: Locator
  readonly memberList: Locator
  readonly categorySection: Locator
  readonly activityLogSection: Locator

  constructor(page: Page) {
    super(page, '/settings')
    this.pageTitle = this.locator('h1:has-text("設定")')
    this.groupSection = this.locator('text=家庭成員')
    this.membersSection = this.locator('text=成員')
    this.addMemberButton = this.locator('button:has-text("新增成員")')
    this.memberInputs = this.locator('input[placeholder*="成員"]')
    this.memberList = this.locator('.space-y-2')
    this.categorySection = this.locator('text=類別管理')
    this.activityLogSection = this.locator('text=操作日誌')
  }

  async expectLoaded(): Promise<void> {
    await expect(this.pageTitle).toBeVisible({ timeout: 15000 })
  }

  async clickAddMember(): Promise<void> {
    await this.addMemberButton.click()
  }

  async fillMemberName(name: string): Promise<void> {
    await this.memberInputs.last().fill(name)
  }

  async getMemberCount(): Promise<number> {
    return this.memberList.locator('.flex.items-center').count()
  }

  async navigateToCategories(): Promise<void> {
    await this.locator('a[href="/settings/categories"]').click()
    await expect(this.page).toHaveURL('/settings/categories')
  }

  async navigateToActivityLog(): Promise<void> {
    await this.locator('a[href="/settings/activity-log"]').click()
    await expect(this.page).toHaveURL('/settings/activity-log')
  }
}

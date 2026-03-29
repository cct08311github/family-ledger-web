import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './BasePage'

export class NotificationsPage extends BasePage {
  readonly pageTitle: Locator
  readonly markAllReadButton: Locator
  readonly notificationList: Locator
  readonly notificationItems: Locator
  readonly emptyState: Locator
  readonly unreadBadge: Locator

  constructor(page: Page) {
    super(page, '/notifications')
    this.pageTitle = this.locator('h1:has-text("通知")')
    this.markAllReadButton = this.locator('button:has-text("全部標為已讀")')
    this.notificationList = this.locator('.rounded-2xl.border')
    this.notificationItems = this.notificationList.locator('button')
    this.emptyState = this.locator('text=沒有通知')
    this.unreadBadge = this.locator('.animate-spin')
  }

  async expectLoaded(): Promise<void> {
    await expect(this.pageTitle).toBeVisible({ timeout: 15000 })
  }

  async getNotificationCount(): Promise<number> {
    return this.notificationItems.count()
  }

  async clickNotification(index: number): Promise<void> {
    await this.notificationItems.nth(index).click()
  }

  async clickMarkAllRead(): Promise<void> {
    if (await this.markAllReadButton.isVisible()) {
      await this.markAllReadButton.click()
    }
  }

  async hasUnreadNotifications(): Promise<boolean> {
    const badges = this.notificationItems.filter({ has: this.locator('.rounded-full.bg-\\[var\\(--primary\\)\\]') })
    return (await badges.count()) > 0
  }

  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible()
  }
}

import { test, expect } from '@playwright/test'
import { ExpenseFormPage } from '../pages/ExpenseFormPage'
import { RecordsPage } from '../pages/RecordsPage'

/**
 * 支出 CRUD 測試
 *
 * 注意：這些測試需要 Firebase 認證。在沒有 Firebase Emulator 或測試帳號的情況下，
 * 這些測試會因為 auth redirect 而失敗或超時。
 *
 * 要完整執行這些測試，需要：
 * 1. 設定 Firebase Auth Emulator
 * 2. 或使用測試 Google 帳號進行 OAuth
 */

test.describe('支出 CRUD (Expense CRUD)', () => {
  test.skip('TC-EXPENSE-001: 新增支出頁面需要認證', async ({ page }) => {
    // 此測試需要 Firebase Auth，無法在沒有測試帳號的情況下執行
    const expensePage = new ExpenseFormPage(page, '/expense/new')
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.expectLoaded()
    await expect(page.locator('h1:has-text("新增支出")')).toBeVisible()
  })

  test.skip('TC-EXPENSE-002: 驗證必填欄位需要認證', async ({ page }) => {
    const expensePage = new ExpenseFormPage(page, '/expense/new')
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.clickSave()
    const errorMsg = page.locator('p:text("請填寫必要欄位")')
    await expect(errorMsg).toBeVisible()
  })

  test.skip('TC-EXPENSE-003: 填寫基本支出資訊需要認證', async ({ page }) => {
    const expensePage = new ExpenseFormPage(page, '/expense/new')
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.fillDescription('測試晚餐')
    await expensePage.fillAmount('500')
  })

  test.skip('TC-EXPENSE-004: 選擇支出類型需要認證', async ({ page }) => {
    const expensePage = new ExpenseFormPage(page, '/expense/new')
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.selectExpenseType('個人')
    await expensePage.selectExpenseType('共同')
  })

  test.skip('TC-EXPENSE-005: 選擇付款方式需要認證', async ({ page }) => {
    const expensePage = new ExpenseFormPage(page, '/expense/new')
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.selectPaymentMethod('現金')
    await expensePage.selectPaymentMethod('信用卡')
    await expensePage.selectPaymentMethod('轉帳')
  })

  test.skip('TC-EXPENSE-006: 選擇分帳方式需要認證', async ({ page }) => {
    const expensePage = new ExpenseFormPage(page, '/expense/new')
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.fillAmount('1000')
    await expensePage.selectSplitMethod('equal')
    await expensePage.selectSplitMethod('percentage')
    await expensePage.selectSplitMethod('custom')
  })

  test.skip('TC-EXPENSE-007: 日期輸入需要認證', async ({ page }) => {
    const expensePage = new ExpenseFormPage(page, '/expense/new')
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.fillDate('2026-03-15')
  })

  test.skip('TC-EXPENSE-008: 描述自動完成需要認證', async ({ page }) => {
    const expensePage = new ExpenseFormPage(page, '/expense/new')
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.descriptionInput.click()
    await expensePage.descriptionInput.fill('測試')
  })
})

test.describe('記錄頁面 (Records Page)', () => {
  test.skip('TC-RECORDS-001: 記錄頁面需要認證', async ({ page }) => {
    const recordsPage = new RecordsPage(page)
    await recordsPage.goto()
    await recordsPage.waitForLoadState('networkidle')

    await recordsPage.expectLoaded()
  })

  test.skip('TC-RECORDS-002: 篩選功能需要認證', async ({ page }) => {
    const recordsPage = new RecordsPage(page)
    await recordsPage.goto()
    await recordsPage.waitForLoadState('networkidle')

    await recordsPage.filterBy('全部')
    await recordsPage.filterBy('共同')
    await recordsPage.filterBy('個人')
  })
})

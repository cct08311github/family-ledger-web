import { test, expect } from '@playwright/test'
import { ExpenseFormPage } from '../pages/ExpenseFormPage'
import { RecordsPage } from '../pages/RecordsPage'
import { createTestUser, signInWithEmailPassword, deleteTestUser } from '../helpers/test-auth'

/**
 * 支出 CRUD 測試
 *
 * 注意：這些測試需要 Firebase 認證。使用 Firebase Auth Emulator 進行認證。
 */

test.describe('支出 CRUD (Expense CRUD)', () => {
  let expensePage: ExpenseFormPage
  let testUserEmail: string
  let testUserPassword: string
  let testUserUid: string

  test.beforeAll(async () => {
    testUserEmail = `expense${Date.now()}@emulator.test`
    testUserPassword = 'testpass123'
    const user = await createTestUser(testUserEmail, testUserPassword, '測試使用者')
    testUserUid = user.uid
  })

  test.afterAll(async () => {
    if (testUserUid) {
      await deleteTestUser(testUserUid)
    }
  })

  test.beforeEach(async ({ page }) => {
    expensePage = new ExpenseFormPage(page, '/expense/new')
    await signInWithEmailPassword(page, testUserEmail, testUserPassword)
  })

  test('TC-EXPENSE-001: 新增支出頁面需要認證', async ({ page }) => {
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.expectLoaded()
    await expect(page.locator('h1:has-text("新增支出")')).toBeVisible()
  })

  test('TC-EXPENSE-002: 驗證必填欄位需要認證', async ({ page }) => {
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.clickSave()
    const errorMsg = page.locator('p:text("請填寫必要欄位")')
    await expect(errorMsg).toBeVisible()
  })

  test('TC-EXPENSE-003: 填寫基本支出資訊需要認證', async ({ page }) => {
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.fillDescription('測試晚餐')
    await expensePage.fillAmount('500')
  })

  test('TC-EXPENSE-004: 選擇支出類型需要認證', async ({ page }) => {
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.selectExpenseType('個人')
    await expensePage.selectExpenseType('共同')
  })

  test('TC-EXPENSE-005: 選擇付款方式需要認證', async ({ page }) => {
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.selectPaymentMethod('現金')
    await expensePage.selectPaymentMethod('信用卡')
    await expensePage.selectPaymentMethod('轉帳')
  })

  test('TC-EXPENSE-006: 選擇分帳方式需要認證', async ({ page }) => {
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.fillAmount('1000')
    await expensePage.selectSplitMethod('equal')
    await expensePage.selectSplitMethod('percentage')
    await expensePage.selectSplitMethod('custom')
  })

  test('TC-EXPENSE-007: 日期輸入需要認證', async ({ page }) => {
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.fillDate('2026-03-15')
  })

  test('TC-EXPENSE-008: 描述自動完成需要認證', async ({ page }) => {
    await expensePage.goto()
    await expensePage.waitForLoadState('networkidle')

    await expensePage.descriptionInput.click()
    await expensePage.descriptionInput.fill('測試')
  })
})

test.describe('記錄頁面 (Records Page)', () => {
  let recordsPage: RecordsPage
  let testUserEmail: string
  let testUserPassword: string
  let testUserUid: string

  test.beforeAll(async () => {
    testUserEmail = `records${Date.now()}@emulator.test`
    testUserPassword = 'testpass123'
    const user = await createTestUser(testUserEmail, testUserPassword, '測試使用者')
    testUserUid = user.uid
  })

  test.afterAll(async () => {
    if (testUserUid) {
      await deleteTestUser(testUserUid)
    }
  })

  test.beforeEach(async ({ page }) => {
    recordsPage = new RecordsPage(page)
    await signInWithEmailPassword(page, testUserEmail, testUserPassword)
  })

  test('TC-RECORDS-001: 記錄頁面需要認證', async ({ page }) => {
    await recordsPage.goto()
    await recordsPage.waitForLoadState('networkidle')

    await recordsPage.expectLoaded()
  })

  test('TC-RECORDS-002: 篩選功能需要認證', async ({ page }) => {
    await recordsPage.goto()
    await recordsPage.waitForLoadState('networkidle')

    await recordsPage.filterBy('全部')
    await recordsPage.filterBy('共同')
    await recordsPage.filterBy('個人')
  })
})

# Family-Ledger Web — Issues 清單（待建立）

> 建立方式：複製以下內容，一次一個貼到 GitHub New Issue，或使用 [GitHub CLI](https://cli.github.com/)：`gh issue create --title "..." --body "..." --project "..."`

---

## Milestone 1：Sprint 1 - 止血（1-2 週）

---

### 🔴 P0 - Critical Bugs

---

#### Issue #1：\[P0 Bug\] calculateNetBalances 結算增減方向錯誤

**描述**：
`src/lib/services/split-calculator.ts` 中的 `calculateNetBalances` 函式，在處理結算記錄（settlements）時，增減方向完全顛倒。

**現況**：
```typescript
// ❌ 錯誤
balances[s.fromMemberId] = (balances[s.fromMemberId] ?? 0) + s.amount
balances[s.toMemberId] = (balances[s.toMemberId] ?? 0) - s.amount
```

**預期行為**：
- A 欠 B 100元 → balances[A] = -100, balances[B] = +100
- B 付款給 A 100元（結算）→ balances[A] = 0, balances[B] = 0
- 結算後，雙方餘額應當歸零或遞減，而非遞增/遞減方向錯誤

**修復方式**：
```typescript
// ✅ 正確
balances[s.fromMemberId] = (balances[s.fromMemberId] ?? 0) - s.amount
balances[s.toMemberId] = (balances[s.toMemberId] ?? 0) + s.amount
```

**標籤**：`bug`, `critical`, `P0`
**Milestone**：Sprint 1 - 止血

---

#### Issue #2：\[P0\] 所有 CRUD 操作未寫入 ActivityLog

**描述**：
`activity-log-service.ts` 定義了完整的 `addActivityLog` 函式，但 expense、settlement、member、category 的所有 CRUD service 都沒有呼叫它。操作稽核軌跡目前全空白。

**受影響的檔案**：
- `src/lib/services/expense-service.ts`（addExpense / updateExpense / deleteExpense）
- `src/lib/services/settlement-service.ts`（addSettlement）
- `src/lib/services/member-service.ts`（addMember / removeMember）
- `src/lib/services/category-service.ts`（addCategory / updateCategory / deleteCategory）

**修復方式**：
在每次 Firestore 寫入成功後，補上 `addActivityLog()` 呼叫。

**標籤**：`bug`, `critical`, `P0`
**Milestone**：Sprint 1 - 止血

---

#### Issue #3：\[P0\] 刪除 currentUser 成員時無遞補邏輯

**描述**：
當刪除 `isCurrentUser === true` 的成員時，沒有其他成員遞補成為 current user。這會導致：
1. settings 頁的「我」標記消失
2. 依賴 `isCurrentUser` 的功能永久失效
3. 使用者需要重新登出再登入才能恢復

**受影響的檔案**：`src/lib/services/member-service.ts` - `removeMember`

**修復方式**：
刪除成員前，先確認是否為 currentUser；若是，先找另一個成員遞補，再執行刪除。

**標籤**：`bug`, `critical`, `P0`
**Milestone**：Sprint 1 - 止血

---

### 🟡 P1 - Engineering Quality

---

#### Issue #4：\[P1\] split-calculator 缺少單元測試

**描述**：
`split-calculator.ts` 是系統核心邏輯，但完全沒有單元測試覆蓋。導致上述 P0 bug 能夠隱藏至今。

**受影響的檔案**：`src/lib/services/split-calculator.ts`

**建議測試案例**：
1. 兩人等分支出，餘額正確
2. 三人等分，餘額正確（含除法餘數處理）
3. 結算後餘額歸零
4. 結算金額小於欠款，只扣減對應部分
5. simplifyDebts 貪心演算法輸出轉帳次數最少

**標籤**：`enhancement`, `testing`, `P1`
**Milestone**：Sprint 1 - 止血

---

#### Issue #5：\[P2\] useMembers 缺少 loading state

**描述**：
`useExpenses`、`useGroup` 都有回傳 `loading` 狀態，但 `useMembers` 從頭到尾只回傳 members array，沒有 loading。造成呼叫端 UI 體驗不一致。

**受影響的檔案**：`src/lib/hooks/use-members.ts`

**修復方式**：
新增 `loading` state，與 `useExpenses` 模式一致。

**標籤**：`bug`, `P2`
**Milestone**：Sprint 1 - 止血

---

#### Issue #6：\[P2\] records 頁刪除操作無錯誤處理

**描述**：
刪除 expense 時，`deleteExpense` 失敗的情況完全沒有 UI 提示。使用者可能以為刪掉了但實際失敗。

**受影響的檔案**：`src/app/(auth)/records/page.tsx`

**修復方式**：
包 try-catch，失敗時 toast 或 inline error 訊息告知用戶。

**標籤**：`bug`, `P2`
**Milestone**：Sprint 1 - 止血

---

## Milestone 2：Sprint 2 - 結構重構（2-4 週）

---

#### Issue #7：\[P1\] 建立 shared domain package

**描述**：
Flutter App 和 Next.js Web 的 business logic（split-calculator、local-expense-parser、types）目前是兩份重複的 code。長期 drift 風險極高。

**建議方案**：
在 `/shared/projects/` 下建立 `packages/family-ledger-domain/`：

```
packages/family-ledger-domain/
├── src/
│   ├── split-calculator.ts
│   ├── local-expense-parser.ts
│   ├── types.ts
│   └── firestore-schema.ts
├── package.json
└── tsconfig.json
```

Flutter 和 Web 都從這個 package 引入 business logic。

**標籤**：`enhancement`, `refactoring`, `P1`
**Milestone**：Sprint 2 - 結構重構

---

#### Issue #8：\[P1\] Web 抽出 Repository Pattern

**描述**：
目前 Web 的 business logic 散在 hooks 和 services 之間，直接依賴 Firestore，難以測試。

**建議方案**：
```
Presentation Layer（Page Components）
        ↓
Application Layer（Services / Use Cases）
        ↓
Repository Interface（定義資料操作合約）
        ↓
Infrastructure Layer（FirestoreRepository 實作）
```

新增 `src/lib/repositories/` 目錄，定義 `ExpenseRepository`、`MemberRepository` 等介面，並以 Firestore 實作。

**標籤**：`enhancement`, `refactoring`, `P1`
**Milestone**：Sprint 2 - 結構重構

---

#### Issue #9：\[P1\] Firebase Auth Emulator 架設

**描述**：
34/54 Playwright E2E 測試因需要 Firebase Auth 而 skip。測試環境完全綁定線上 Firebase，無法做獨立的 CI regression。

**修復方式**：
1. 安裝 Firebase CLI + Emulator Suite
2. `firebase init emulators` 設定 Auth Emulator
3. Playwright 測試改为连接 `localhost:9099`（Emulator）
4. 修復其餘 34 個測試回到 green

**標籤**：`enhancement`, `testing`, `infrastructure`, `P1`
**Milestone**：Sprint 2 - 結構重構

---

#### Issue #10：\[P1\] 建立 GitHub Actions CI

**描述**：
目前沒有任何 CI pipeline，壞掉的測試不會在 PR level 被 catch。

**建議流程**：
```yaml
on: [push, pull_request]
jobs:
  - npm ci
  - npm run lint
  - npm run test
  - npx playwright test (with Emulator)
```

**標籤**：`enhancement`, `infrastructure`, `P1`
**Milestone**：Sprint 2 - 結構重構

---

## Milestone 3：Sprint 3 - 強化（4-8 週）

---

#### Issue #11：\[P2\] Web 離線支援（IndexedDB Cache）

**描述**：
Web 版在網路不穩或離線時完全無法使用。建議實作基本的 IndexedDB cache。

**建議方案**：
1. 首次 load → Firestore snapshot → 寫入 IndexedDB
2. 離線時 → 從 IndexedDB 讀取
3. 連線恢復 → 重新 sync

**標籤**：`enhancement`, `PWA`, `P2`
**Milestone**：Sprint 3 - 強化

---

#### Issue #12：\[P3\] Firebase Security Rules 建立 PR Review 流程

**描述**：
`firestore.rules` 和 `storage.rules` 目前是檔案，但沒有被列為正式 review 項目。security rule 錯誤可能導致資料外洩。

**建議方案**：
1. 每次改 `firestore.rules` 必須附上 PR 說明
2. `firebase deploy --only firestore:rules` 加入 CD pipeline
3. 訂閱 Firebase Release Notes 追新功能相容性

**標籤**：`security`, `enhancement`, `P3`
**Milestone**：Sprint 3 - 強化

---

## 標籤彙整（供 GitHub Projects 使用）

```
Priority: P0, P1, P2, P3
Type: bug, enhancement, refactoring, testing, infrastructure, security, PWA
Milestone: Sprint 1 - 止血, Sprint 2 - 結構重構, Sprint 3 - 強化
```

---

**建立時間**：2026-03-30
**建議順序**：先建 #1 → #2 → #3（止血優先），再往後

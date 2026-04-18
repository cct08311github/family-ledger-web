# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family expense sharing app (家計本) built with Next.js App Router, React 19, TypeScript, and Firebase. Supports shared expense tracking, automatic split calculation, debt simplification, and real-time sync across family members.

## ⚠ 重要警告：此 cwd 是 PM2 的 live-serve 路徑

**此專案目錄（`/Users/openclaw/.openclaw/shared/projects/family-ledger-web`）同時是 PM2 `family-ledger-web` 的 production serve cwd**（port 3013，Tailscale 上家人在用）。

任何會寫入 `.next/` 的命令會**立即影響生產使用者**：

| 命令 | 在此 cwd 安全嗎？ |
|------|----------------|
| `npm run lint` / `npm test` / `npx tsc --noEmit` | ✅ 唯讀，安全 |
| `npm run build` / `npm run dev` / `npm run start` | ❌ **會覆蓋 `.next/`**，PM2 的 server process 記憶體仍持舊 chunk 參考 → 使用者看到 chunk 404 → 「載入失敗」error boundary |
| `npm ci` / `npm install` | ⚠️ 寫 `node_modules`，native addon 或熱重載模組可能 break |

**正確做法**：debug 或 build 請用 worktree：
```bash
git worktree add ../family-ledger-debug main
cd ../family-ledger-debug
npm run build  # 安全，自己的 .next，不碰 prod
```

若必須在此 cwd build：`pm2 stop family-ledger-web && npm run build && pm2 restart family-ledger-web`。

此規則的血淚來源：2026-04-18 在此 cwd 跑 `npm run build` 除錯，反而直接造成 production 「新增支出載入失敗」。

## Commands

```bash
# 唯讀（safe in this cwd）
npm run lint     # ESLint check
npm run test     # Jest unit tests
npx playwright test  # E2E tests (requires Auth emulator)

# 寫入 .next（在此 cwd 等同 deploy — 見上方警告）
npm run dev      # Start development server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
```

## Tech Stack

- **Framework**: Next.js 16 (App Router) with Turbopack
- **UI**: React 19, Tailwind CSS v4 (CSS custom properties for theming), next-themes
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Charts**: recharts
- **Language**: TypeScript (strict mode)

## Architecture

### Route Structure

```
src/app/
├── layout.tsx              # Root layout: ThemeProvider + AuthProvider
├── globals.css            # CSS custom properties (theme colors)
├── login/page.tsx          # Google sign-in page
└── (auth)/                # Auth-guarded routes
    ├── layout.tsx          # Redirects to /login if unauthenticated
    ├── page.tsx            # Home: monthly summary, debts, recent expenses
    ├── expense/
    │   ├── new/page.tsx    # New expense form
    │   └── [id]/page.tsx   # Edit existing expense
    ├── records/page.tsx    # Full expense list
    ├── split/page.tsx      # Debt settlement overview
    ├── statistics/page.tsx # Charts
    ├── settings/page.tsx   # Group/member management
    └── notifications/page.tsx
```

### Data Layer (Firestore)

Collections follow this pattern:
```
groups/{groupId}/
  ├── members/          # FamilyMember documents
  ├── expenses/         # Expense documents (ordered by date desc)
  └── settlements/      # Settlement records (ordered by date desc)

groups/{groupId} document:
  - memberUids: string[]  (used to find user's group)
  - isPrimary: boolean
```

Real-time subscriptions via custom hooks in `src/lib/hooks/`. All hooks return data directly (no loading/error wrapper) — components handle loading states themselves.

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/auth.tsx` | Firebase Auth context + `useAuth` hook |
| `src/lib/firebase.ts` | Firebase app init (singleton pattern) |
| `src/lib/types.ts` | TypeScript interfaces for all entities |
| `src/lib/utils.ts` | Formatters: `currency()`, `fmtDate()`, `toDate()` |
| `src/lib/services/expense-service.ts` | addExpense, updateExpense, deleteExpense |
| `src/lib/services/settlement-service.ts` | addSettlement |
| `src/lib/services/split-calculator.ts` | `simplifyDebts()` greedy algorithm |
| `src/components/expense-form.tsx` | Full expense CRUD form with split preview |
| `src/components/nav-shell.tsx` | Sidebar + bottom nav + mobile FAB |

### Component Patterns

- All components using Firebase/hooks must have `'use client'` directive
- Auth check in `(auth)/layout.tsx` redirects to `/login` if `user` is null
- Forms use local state with `useState` — no external form library
- Split preview (equal/percentage/custom) calculated live in `buildSplits()`
- Description autocomplete fetches from `useExpenses` recent descriptions

### Theme / Styling

Tailwind CSS v4 with CSS custom properties defined in `globals.css`. Key variables: `--primary`, `--border`, `--card`, `--muted`, `--foreground`, `--destructive`. Uses `color-mix()` for tint variants.

## Firebase Project

- Project ID: `family-ledger-784ed`
- Auth: Google OAuth only
- Database: Firestore (localized in Taiwan)
- Storage: Receipt image uploads

### Rules Deploy

- CI workflow: `.github/workflows/deploy-rules.yml` — auto-deploys `firestore.rules` / `storage.rules` when they change on `main`. Requires `FIREBASE_DEPLOY_TOKEN` secret.
- **Manual fallback** (if the workflow fails — see Issue #169):
  ```bash
  firebase deploy --only firestore:rules,storage --project family-ledger-784ed
  ```
- **Regenerate CI token** when expired: `firebase login:ci` locally, paste output into repo Settings → Secrets and variables → Actions → `FIREBASE_DEPLOY_TOKEN`.
- Workflow now has a pre-flight check that fails with a clear instruction if the secret is missing, and a post-deploy smoke that verifies the live rules are non-empty.

## Testing

### Unit Tests
- `__tests__/local-parser.test.ts` - 25 tests for local expense parsing
- `__tests__/split-calculator.test.ts` - 17 tests for split calculator
- Run: `npm run test`

### E2E Tests (Playwright)
- `tests/` - 54 test cases covering auth, expense, split, statistics, notifications, settings, voice, PWA
- 20 passing (smoke, auth flow, PWA, routes)
- 34 enabled with Firebase Auth Emulator (requires emulator in CI)
- Run: `npx playwright test`
- Config: `playwright.config.ts`

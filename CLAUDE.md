# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family expense sharing app (家計本) built with Next.js App Router, React 19, TypeScript, and Firebase. Supports shared expense tracking, automatic split calculation, debt simplification, and real-time sync across family members.

## Commands

```bash
npm run dev      # Start development server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint check
npm run test     # Jest unit tests (25 tests)
npx playwright test  # E2E tests (54 tests, 20 passing, 34 require Auth)
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

## Testing

### Unit Tests
- `__tests__/local-parser.test.ts` - 25 tests for local expense parsing
- Run: `npm run test`

### E2E Tests (Playwright)
- `tests/` - 54 test cases covering auth, expense, split, statistics, notifications, settings, voice, PWA
- 20 passing (smoke, auth flow, PWA, routes)
- 34 skipped (require Firebase Auth Emulator)
- Run: `npx playwright test`
- Config: `playwright.config.ts`

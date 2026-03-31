/**
 * Test Authentication Helper for Playwright E2E Tests
 *
 * Provides utilities to:
 * - Create test users in Auth Emulator
 * - Sign in via Firebase Auth SDK in Playwright browser context
 * - Check emulator availability (skip tests gracefully when unavailable)
 */

import type { Page } from '@playwright/test'
import { test } from '@playwright/test'

const EMULATOR_HOST = process.env.FIREBASE_EMULATOR_HOST ?? 'localhost'

export interface TestUser {
  uid: string
  email: string
  password: string
  displayName: string
}

const TEST_PROJECT_ID = 'demo-test'

/**
 * Check if Firebase Auth Emulator is available.
 * Returns true if the emulator is reachable, false otherwise.
 */
export async function isEmulatorAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(
      `http://${EMULATOR_HOST}:9099/identitytoolkit/v1/relyingparty/getAccountInfo`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1 }),
        signal: controller.signal,
      }
    )
    clearTimeout(timeoutId)
    // Auth Emulator returns 400 for getAccountInfo with empty users array, but reachable
    return response.ok || response.status === 400
  } catch {
    return false
  }
}

/**
 * Skip all tests in a describe block if Firebase Auth Emulator is unavailable.
 * Call this at the start of beforeAll in auth-dependent test suites.
 */
export async function skipIfEmulatorUnavailable(): Promise<boolean> {
  const available = await isEmulatorAvailable()
  if (!available) {
    test.skip(true, 'Firebase Auth Emulator not available. Run "firebase emulators:start" first.')
    return false
  }
  return true
}

/**
 * Create a test user in the Auth Emulator via REST API.
 * Throws if emulator is unavailable.
 */
export async function createTestUser(
  email: string,
  password: string,
  displayName: string
): Promise<TestUser> {
  const response = await fetch(
    `http://${EMULATOR_HOST}:9099/identitytoolkit/v3/relyingparty/signupNewUser`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to create test user: ${await response.text()}`)
  }

  const data = await response.json()
  return { uid: data.localId, email, password, displayName }
}

/**
 * Delete a test user from the Auth Emulator.
 */
export async function deleteTestUser(uid: string): Promise<void> {
  await fetch(
    `http://${EMULATOR_HOST}:9099/identitytoolkit/v3/relyingparty/deleteAccount`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid }),
    }
  )
}

/**
 * Sign in via Firebase Auth SDK in Playwright browser context.
 *
 * Works because:
 * 1. firebase.ts calls connectAuthEmulator() when USE_FIREBASE_EMULATOR=true
 * 2. The app already imports firebase.ts, so auth instance is emulator-connected
 * 3. signInWithEmailAndPassword routes to Auth Emulator
 * 4. Firebase Auth session is stored in browser, triggering onAuthStateChanged
 */
export async function signInWithEmailPassword(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.evaluate(
    async ({ email, password }) => {
      const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth')
      const { auth } = await import('@lib/firebase')
      await signInWithEmailAndPassword(auth, email, password)
    },
    { email, password }
  )
}

/**
 * Sign out from Firebase Auth in browser context.
 */
export async function signOut(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { getAuth, signOut } = await import('firebase/auth')
    const { auth } = await import('@lib/firebase')
    await signOut(auth)
  })
}

/**
 * Create a signed-in browser context with a test user.
 * Sets up localStorage state so onAuthStateChanged fires immediately.
 */
export async function withAuthenticatedUser<T>(
  page: Page,
  email: string,
  password: string,
  fn: () => Promise<T>
): Promise<T> {
  await signInWithEmailPassword(page, email, password)
  // Wait for auth state to propagate
  await page.waitForTimeout(1000)
  try {
    return await fn()
  } finally {
    await signOut(page)
  }
}

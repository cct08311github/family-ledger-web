/**
 * Firebase Auth Emulator helper for E2E tests
 *
 * Provides utilities to:
 * - Create test users in the Auth Emulator
 * - Sign in via email/password (easier than Google OAuth for testing)
 */

// Emulator REST API endpoints
const EMULATOR_HOST = process.env.FIREBASE_EMULATOR_HOST ?? 'localhost'
const AUTH_EMULATOR_URL = `http://${EMULATOR_HOST}:9099`

export interface TestUser {
  uid: string
  email: string
  password: string
  displayName: string
}

/**
 * Create a test user in the Firebase Auth Emulator
 */
export async function createTestUser(user: TestUser): Promise<void> {
  const response = await fetch(`${AUTH_EMULATOR_URL}/identitytoolkit/v1/relyingparty/signupNewUser`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      displayName: user.displayName,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create test user: ${await response.text()}`)
  }
}

/**
 * Create multiple test users for a family group
 */
export async function setupTestFamily(): Promise<TestUser[]> {
  const family = [
    { email: 'dad@test.com', password: 'testpass123', displayName: '爸爸' },
    { email: 'mom@test.com', password: 'testpass123', displayName: '媽媽' },
    { email: 'kid@test.com', password: 'testpass123', displayName: '小孩' },
  ]

  for (const user of family) {
    await createTestUser(user)
  }

  return family
}

/**
 * Sign in via email/password (Firebase Auth Emulator REST API)
 * Returns the idToken needed for authenticated requests
 */
export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<string> {
  const response = await fetch(`${AUTH_EMULATOR_URL}/identitytoolkit/v1/relyingparty/verifyPassword`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to sign in: ${await response.text()}`)
  })

  const data = await response.json()
  return data.idToken
}

/**
 * Delete a test user from the Auth Emulator
 */
export async function deleteTestUser(email: string): Promise<void> {
  // First get the user by email to get the localId
  const response = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit/v1/relyingparty/getAccountInfo`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }
  )

  if (!response.ok) {
    return // User doesn't exist, nothing to delete
  }

  const data = await response.json()
  if (data.users && data.users.length > 0) {
    const uid = data.users[0].localId
    await fetch(`${AUTH_EMULATOR_URL}/identitytoolkit/v1/relyingparty/deleteAccount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid }),
    })
  }
}

/**
 * Clear all test users from the Auth Emulator
 * Warning: This deletes ALL users in the emulator
 */
export async function clearAllTestUsers(): Promise<void> {
  // List all users
  const response = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit/v1/relyingparty/getAccountInfo`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 100 }),
    }
  )

  if (!response.ok) {
    return
  }

  const data = await response.json()
  if (data.users) {
    for (const user of data.users) {
      await fetch(`${AUTH_EMULATOR_URL}/identitytoolkit/v1/relyingparty/deleteAccount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: user.localId }),
      })
    }
  }
}

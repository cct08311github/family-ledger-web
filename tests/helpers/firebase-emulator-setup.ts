/**
 * Firebase Emulator Setup Helper for E2E Tests
 *
 * Provides utilities to:
 * - Set up test group with members in Firestore emulator
 * - Seed test expenses
 */

import type { TestUser } from './firebase-auth-emulator'

const EMULATOR_HOST = process.env.FIREBASE_EMULATOR_HOST ?? 'localhost'
const FIRESTORE_EMULATOR_URL = `http://${EMULATOR_HOST}:8080`
const PROJECT_ID = 'family-ledger-784ed'

interface TestMember {
  id: string
  name: string
  isCurrentUser?: boolean
}

/**
 * Create a test group with members in Firestore
 */
export async function setupTestGroup(
  ownerUid: string,
  ownerName: string,
  members: TestMember[]
): Promise<string> {
  const groupId = `test-group-${Date.now()}`

  // Create group document
  await fetch(
    `https://${PROJECT_ID}.firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/groups/${groupId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner',
      },
      body: JSON.stringify({
        fields: {
          name: { stringValue: '測試家庭' },
          ownerUid: { stringValue: ownerUid },
          memberUids: {
            arrayValue: {
              values: members.map((m) => ({ stringValue: m.id })),
            },
          },
          isPrimary: { booleanValue: true },
          createdAt: { timestampValue: new Date().toISOString() },
        },
      }),
    }
  )

  // Create member documents
  for (const member of members) {
    await fetch(
      `https://${PROJECT_ID}.firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/groups/${groupId}/members/${member.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner',
        },
        body: JSON.stringify({
          fields: {
            name: { stringValue: member.name },
            role: { stringValue: 'member' },
            isCurrentUser: { booleanValue: member.isCurrentUser ?? false },
            sortOrder: { integerValue: 0 },
          },
        }),
      }
    )
  }

  return groupId
}

/**
 * Seed test expenses for a group
 */
export async function seedTestExpenses(
  groupId: string,
  expenses: Array<{
    description: string
    amount: number
    category: string
    payerId: string
    payerName: string
    isShared: boolean
  }>
): Promise<void> {
  for (let i = 0; i < expenses.length; i++) {
    const exp = expenses[i]
    const docId = `test-exp-${Date.now()}-${i}`

    await fetch(
      `https://${PROJECT_ID}.firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/groups/${groupId}/expenses/${docId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner',
        },
        body: JSON.stringify({
          fields: {
            description: { stringValue: exp.description },
            amount: { integerValue: exp.amount },
            category: { stringValue: exp.category },
            payerId: { stringValue: exp.payerId },
            payerName: { stringValue: exp.payerName },
            isShared: { booleanValue: exp.isShared },
            date: { timestampValue: new Date().toISOString() },
            splitMethod: { stringValue: 'equal' },
            paymentMethod: { stringValue: 'cash' },
            createdBy: { stringValue: exp.payerId },
            splits: {
              arrayValue: {
                values: exp.isShared
                  ? [
                      { mapValue: { fields: { memberId: { stringValue: exp.payerId }, memberName: { stringValue: exp.payerName }, shareAmount: { integerValue: exp.amount }, paidAmount: { integerValue: exp.amount }, isParticipant: { booleanValue: true } } } },
                    ]
                  : [],
              },
            },
          },
        }),
      }
    )
  }
}

/**
 * Clean up test group data
 */
export async function cleanupTestGroup(groupId: string): Promise<void> {
  // Delete expenses
  const expResponse = await fetch(
    `https://${PROJECT_ID}.firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'expenses' }],
          where: {
            fieldFilter: {
              field: { fieldPath: '__name__' },
              op: 'PATH_STARTS_WITH',
              value: { stringValue: `groups/${groupId}/expenses/` },
            },
          },
        },
      }),
    }
  )

  if (expResponse.ok) {
    const expData = await expResponse.json()
    for (const doc of expData) {
      if (doc.document) {
        const docPath = doc.document.name
        await fetch(`https://${PROJECT_ID}.firestore.googleapis.com/v1/${docPath}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer owner' },
        })
      }
    }
  }

  // Delete members
  await fetch(
    `https://${PROJECT_ID}.firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/groups/${groupId}`,
    {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner' },
    }
  )
}

/**
 * Firebase Admin SDK initializer for server-side use (API routes).
 * Uses Application Default Credentials or FIREBASE_SERVICE_ACCOUNT env var.
 */
import { getApps, initializeApp, cert, App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson) as Record<string, string>
    return initializeApp({ credential: cert(serviceAccount) })
  }

  // Fall back to Application Default Credentials (works on GCP / Firebase Hosting)
  return initializeApp()
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}

import { initializeApp, getApps } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyD9FyDSM4-acovBVfMvf_2kLW1IaJcVsMQ',
  authDomain: 'family-ledger-784ed.firebaseapp.com',
  projectId: 'family-ledger-784ed',
  storageBucket: 'family-ledger-784ed.firebasestorage.app',
  messagingSenderId: '137558877215',
  appId: '1:137558877215:ios:7101807b49be145b96a12a',
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Enable offline persistence for Firestore
// This allows the app to work offline and sync when back online
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open - persistence can only be enabled in one tab at a time
      console.warn('[Firebase] Offline persistence skipped: multiple tabs open')
    } else if (err.code === 'unimplemented') {
      // Browser doesn't support offline persistence
      console.warn('[Firebase] Offline persistence not supported in this browser')
    }
  })
}

// Connect to Firebase Emulators in test/development mode
if (process.env.NODE_ENV === 'test' || process.env.USE_FIREBASE_EMULATOR === 'true') {
  const emulatorHost = process.env.FIREBASE_EMULATOR_HOST ?? 'localhost'

  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, emulatorHost, 8080)
  connectStorageEmulator(storage, emulatorHost, 9199)
}

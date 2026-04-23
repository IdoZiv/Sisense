import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getAnalytics, isSupported } from 'firebase/analytics'

function readFirebaseOptions(): FirebaseOptions {
  const {
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_MEASUREMENT_ID,
  } = import.meta.env

  const missing: string[] = []
  if (!VITE_FIREBASE_API_KEY) missing.push('VITE_FIREBASE_API_KEY')
  if (!VITE_FIREBASE_AUTH_DOMAIN) missing.push('VITE_FIREBASE_AUTH_DOMAIN')
  if (!VITE_FIREBASE_PROJECT_ID) missing.push('VITE_FIREBASE_PROJECT_ID')
  if (!VITE_FIREBASE_STORAGE_BUCKET) missing.push('VITE_FIREBASE_STORAGE_BUCKET')
  if (!VITE_FIREBASE_MESSAGING_SENDER_ID) missing.push('VITE_FIREBASE_MESSAGING_SENDER_ID')
  if (!VITE_FIREBASE_APP_ID) missing.push('VITE_FIREBASE_APP_ID')

  if (missing.length) {
    throw new Error(
      `Missing Firebase web config env vars: ${missing.join(', ')}. Copy web/.env.example to web/.env.local and fill values.`,
    )
  }

  return {
    apiKey: VITE_FIREBASE_API_KEY,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    projectId: VITE_FIREBASE_PROJECT_ID,
    storageBucket: VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: VITE_FIREBASE_APP_ID,
    ...(VITE_FIREBASE_MEASUREMENT_ID ? { measurementId: VITE_FIREBASE_MEASUREMENT_ID } : {}),
  }
}

export const firebaseApp = initializeApp(readFirebaseOptions())
export const auth = getAuth(firebaseApp)

export async function initAnalytics() {
  if (import.meta.env.DEV) return null
  if (!(await isSupported())) return null
  return getAnalytics(firebaseApp)
}


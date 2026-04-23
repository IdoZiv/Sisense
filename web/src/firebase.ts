import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyBLuKc3d2trNJMLg5vWrkLWQovUxiIjZ18',
  authDomain: 'sisense-7e442.firebaseapp.com',
  projectId: 'sisense-7e442',
  storageBucket: 'sisense-7e442.firebasestorage.app',
  messagingSenderId: '457794678586',
  appId: '1:457794678586:web:857ee56db610a64f25ea03',
  measurementId: 'G-S60RD6SSWD',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)

export async function initAnalytics() {
  if (import.meta.env.DEV) return null
  if (!(await isSupported())) return null
  return getAnalytics(firebaseApp)
}


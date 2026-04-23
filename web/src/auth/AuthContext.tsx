import { onAuthStateChanged } from 'firebase/auth'
import React, { useEffect, useMemo, useState } from 'react'
import { auth } from '../firebase'
import { AuthContext, type AuthContextValue } from './authContextDef'
import type { User } from 'firebase/auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ user, loading }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


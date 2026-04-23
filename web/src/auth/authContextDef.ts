import { type User } from 'firebase/auth'
import { createContext } from 'react'

export type AuthContextValue = {
  user: User | null
  loading: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)


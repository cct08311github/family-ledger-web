'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut } from 'firebase/auth'
import { auth } from './firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let settled = false

    // Fallback: force unauthenticated state after 5s to prevent infinite loading
    const timeout = window.setTimeout(() => {
      if (!settled) {
        console.warn('[Auth] onAuthStateChanged timeout — falling back to unauthenticated')
        settled = true
        setUser(null)
        setLoading(false)
      }
    }, 5000)

    let unsubscribe = () => {}
    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (u) => {
          if (settled) return
          settled = true
          window.clearTimeout(timeout)
          setUser(u && !u.isAnonymous ? u : null)
          setLoading(false)
        },
        (err) => {
          console.error('[Auth] onAuthStateChanged error:', err)
          if (settled) return
          settled = true
          window.clearTimeout(timeout)
          setUser(null)
          setLoading(false)
        },
      )
    } catch (err) {
      console.error('[Auth] init error:', err)
      if (!settled) {
        settled = true
        window.clearTimeout(timeout)
        setUser(null)
        setLoading(false)
      }
    }

    return () => {
      window.clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const signOut = async () => {
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react'
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut } from 'firebase/auth'
import { auth } from './firebase'

import { logger } from '@/lib/logger'

interface AuthContextType {
  user: User | null
  loading: boolean
  authError: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Fallback: force unauthenticated state after 5s to prevent infinite loading
    const timeout = setTimeout(() => {
      logger.warn('[Auth] onAuthStateChanged timeout — falling back to unauthenticated')
      setLoading(false)
    }, 5000)

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      clearTimeout(timeout)
      setUser(u && !u.isAnonymous ? u : null)
      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null)
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      // Ignore popup closed by user (common, not an error)
      if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled')) {
        setAuthError('登入失敗，請稍後再試')
        logger.error('[Auth] signInWithGoogle failed:', e)
      }
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    try {
      await fbSignOut(auth)
    } catch (e) {
      logger.error('[Auth] signOut failed:', e)
    }
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    authError,
    signInWithGoogle,
    signOut: handleSignOut,
  }), [user, loading, authError, signInWithGoogle, handleSignOut])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

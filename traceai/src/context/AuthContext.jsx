import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)
const STORAGE_KEY = 'traceai_user'

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // On mount: rehydrate from localStorage, then validate the token against
  // the backend. If the token is stale (user deleted, DB reseeded, etc.)
  // the backend returns 401 and we clear localStorage automatically so the
  // user sees the login page instead of cryptic "User no longer exists" errors.
  useEffect(() => {
    const validate = async () => {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        setLoading(false)
        return
      }

      let parsed
      try {
        parsed = JSON.parse(stored)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
        setLoading(false)
        return
      }

      // No token in stored object — treat as unauthenticated
      if (!parsed?.token) {
        localStorage.removeItem(STORAGE_KEY)
        setLoading(false)
        return
      }

      try {
        // Verify the token is still valid and the user still exists
        const res = await authAPI.me()
        const freshUser = res.data.data.user
        // Merge fresh server data with stored token so name/email stay current
        const merged = { ...freshUser, token: parsed.token }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        setUser(merged)
      } catch {
        // 401 "User no longer exists" or any other auth error — clear stale state
        localStorage.removeItem(STORAGE_KEY)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    validate()
  }, [])

  const login = (userData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  const loginWithBackend = async (email, password) => {
    const res = await authAPI.login({ email, password })
    const { user: userData, token } = res.data.data
    const merged = { ...userData, token }
    login(merged)
    return merged
  }

  const registerWithBackend = async (name, email, password) => {
    const res = await authAPI.register({ name, email, password })
    const { user: userData, token } = res.data.data
    const merged = { ...userData, token }
    login(merged)
    return merged
  }

  const value = {
    user,
    login,
    loginWithBackend,
    registerWithBackend,
    logout,
    loading,
    isAuthenticated: !!user,
    token: user?.token || null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect } from 'react'
import { authApi } from '../api/authApi'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    const loadSession = async () => {
      try {
        await authApi.getCsrf()
        const me = await authApi.getMe()
        if (active) {
          setUser(me)
        }
      } catch {
        if (active) {
          setUser(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      active = false
    }
  }, [])

  const login = async (email, password) => {
    setError(null)
    try {
      const data = await authApi.login({ email, password })
      setUser(data)
      return data
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'Login failed'
      setError(message)
      throw err
    }
  }

  const register = async (name, email, password) => {
    setError(null)
    try {
      const data = await authApi.register({ name, email, password })
      setUser(data)
      return data
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'Registration failed'
      setError(message)
      throw err
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // Clear client session regardless of server response
    } finally {
      setUser(null)
    }
  }

  const updateUser = (updated) => {
    setUser((prev) => (prev ? { ...prev, ...updated } : updated))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

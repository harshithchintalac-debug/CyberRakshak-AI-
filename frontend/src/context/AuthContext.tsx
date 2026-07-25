import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface User {
  id: string; full_name: string; username: string; email: string
  preferred_language: string; role: string; profile_picture?: string | null; avatar_url?: string | null
}

interface AuthContextType {
  user: User
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const DEFAULT_USER: User = {
  id: '6a5ef75a85d0e7561db998ac',
  full_name: 'Demo Agent',
  username: 'demo_agent',
  email: 'agent@cyberrakshak.ai',
  preferred_language: 'en',
  role: 'admin',
  profile_picture: null,
  avatar_url: null,
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(DEFAULT_USER)
  const [loading, setLoading] = useState(false)

  async function refreshUser() {
    try {
      const me = await api.me()
      if (me && typeof me === 'object') {
        setUser(prev => ({ ...prev, ...me }))
      }
    } catch {
      setUser(DEFAULT_USER)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refreshUser() }, [])

  async function login(identifier: string, password: string) {
    try {
      const tokens = await api.login({ identifier, password })
      if (tokens?.access_token) {
        localStorage.setItem('cr_access_token', tokens.access_token)
        localStorage.setItem('cr_refresh_token', tokens.refresh_token)
      }
    } catch {}
    await refreshUser()
  }

  async function register(data: any) {
    try {
      const tokens = await api.register(data)
      if (tokens?.access_token) {
        localStorage.setItem('cr_access_token', tokens.access_token)
        localStorage.setItem('cr_refresh_token', tokens.refresh_token)
      }
    } catch {}
    await refreshUser()
  }

  function logout() {
    localStorage.removeItem('cr_access_token')
    localStorage.removeItem('cr_refresh_token')
    setUser(DEFAULT_USER)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

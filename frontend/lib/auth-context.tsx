"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { responseError } from "./api-client"

export type UserType = "admin" | "organizador" | "membro" | "trainee"

export interface User {
  id: string
  name: string
  email: string
  cargo: string
  type: UserType
  eixo?: string
  photo?: string
  nota_rotacao?: number
  pontos_acumulados?: number
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>
  register: (name: string, cargo: string, email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem("currentUser")
    localStorage.removeItem("token")
  }, [])

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) return
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
    // An earlier request must not overwrite a newer login or logout.
    if (localStorage.getItem("token") !== token) return
    if (res.status === 401) {
      logout()
      return
    }
    if (!res.ok) throw await responseError(res)
    const userData = await res.json()
    setUser(userData)
    localStorage.setItem("currentUser", JSON.stringify(userData))
  }, [logout])

  useEffect(() => {
    const token = localStorage.getItem("token")
    const storedUser = localStorage.getItem("currentUser")
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem("currentUser")
      }
    }
    refreshUser()
      .catch(error => console.error("Erro ao validar sessão:", error))
      .finally(() => setIsLoading(false))
  }, [refreshUser])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        localStorage.setItem("token", data.access_token)
        localStorage.setItem("currentUser", JSON.stringify(data.user))
        return { success: true, user: data.user }
      } else {
        return { success: false, error: response.status === 401
          ? "Email ou senha incorretos"
          : (await responseError(response)).message }
      }
    } catch (error) {
      console.error("Erro de login:", error)
      return { success: false, error: "Erro de conexão com o servidor" }
    }
  }

  const register = async (
    name: string, 
    cargo: string, 
    email: string, 
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, cargo, email, password }),
      })

      if (response.ok) {
        // Log in immediately after successful registration
        return await login(email, password)
      } else {
        return { success: false, error: (await responseError(response)).message }
      }
    } catch (error) {
      console.error("Erro de cadastro:", error)
      return { success: false, error: "Erro de conexão com o servidor" }
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

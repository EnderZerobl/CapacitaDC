"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

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
  must_change_password?: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User; must_change_password?: boolean }>
  register: (name: string, cargo: string, email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const storedUser = localStorage.getItem("currentUser")

    const validateToken = async () => {
      if (token) {
        try {
          const res = await fetch("/api/auth/me", {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          })
          if (res.ok) {
            const userData = await res.json()
            setUser(userData)
            localStorage.setItem("currentUser", JSON.stringify(userData))
          } else {
            // Token is invalid or expired, log out
            logout()
          }
        } catch (e) {
          console.error("Erro ao validar token:", e)
          if (storedUser) {
            setUser(JSON.parse(storedUser))
          }
        }
      }
      setIsLoading(false)
    }

    validateToken()
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: User; must_change_password?: boolean }> => {
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
        return { success: true, user: data.user, must_change_password: data.must_change_password }
      } else {
        const errorData = await response.json()
        return { success: false, error: errorData.detail || "Email ou senha incorretos" }
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
        const errorData = await response.json()
        return { success: false, error: errorData.detail || "Erro ao realizar cadastro" }
      }
    } catch (error) {
      console.error("Erro de cadastro:", error)
      return { success: false, error: "Erro de conexão com o servidor" }
    }
  }

  const changePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const token = localStorage.getItem("token")
    if (!token) return { success: false, error: "Não autenticado" }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ new_password: newPassword }),
      })

      if (response.ok) {
        // Update local user state
        if (user) {
          const updatedUser = { ...user, must_change_password: false }
          setUser(updatedUser)
          localStorage.setItem("currentUser", JSON.stringify(updatedUser))
        }
        return { success: true }
      } else {
        const errorData = await response.json()
        return { success: false, error: errorData.detail || "Erro ao alterar senha" }
      }
    } catch (error) {
      console.error("Erro ao alterar senha:", error)
      return { success: false, error: "Erro de conexão com o servidor" }
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("currentUser")
    localStorage.removeItem("token")
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, changePassword, logout }}>
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

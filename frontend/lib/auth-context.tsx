"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type UserType = "admin" | "membro" | "trainee"

export interface User {
  id: string
  name: string
  email: string
  cargo: string
  type: UserType
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, cargo: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Simulated user database
const mockUsers: (User & { password: string })[] = [
  { id: "1", name: "Admin Info", email: "admin@infoej.com.br", cargo: "Administrador", type: "admin", password: "admin123" },
  { id: "2", name: "Maria Silva", email: "maria@infoej.com.br", cargo: "Analista de Vendas", type: "membro", password: "123456" },
  { id: "3", name: "João Trainee", email: "joao@gmail.com", cargo: "Trainee", type: "trainee", password: "123456" },
]

function getUserTypeByEmail(email: string): UserType {
  // Emails with @infoej.com.br domain are members, others are trainees
  if (email.endsWith("@infoej.com.br")) {
    // Admin check could be based on specific emails
    if (email.startsWith("admin@")) {
      return "admin"
    }
    return "membro"
  }
  return "trainee"
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for stored session
    const storedUser = localStorage.getItem("currentUser")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500))

    const foundUser = mockUsers.find(u => u.email === email && u.password === password)
    
    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser
      setUser(userWithoutPassword)
      localStorage.setItem("currentUser", JSON.stringify(userWithoutPassword))
      return { success: true }
    }

    return { success: false, error: "Email ou senha incorretos" }
  }

  const register = async (
    name: string, 
    cargo: string, 
    email: string, 
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Check if email already exists
    if (mockUsers.find(u => u.email === email)) {
      return { success: false, error: "Este email já está cadastrado" }
    }

    const userType = getUserTypeByEmail(email)
    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      email,
      cargo,
      type: userType,
    }

    // In a real app, this would be saved to a database
    mockUsers.push({ ...newUser, password })
    
    setUser(newUser)
    localStorage.setItem("currentUser", JSON.stringify(newUser))
    
    return { success: true }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("currentUser")
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
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

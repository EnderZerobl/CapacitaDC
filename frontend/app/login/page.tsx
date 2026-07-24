"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2, LayoutGrid, AlertCircle, KeyRound } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { login, changePassword } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Change password modal state
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changeError, setChangeError] = useState("")
  const [isChanging, setIsChanging] = useState(false)
  const [pendingUser, setPendingUser] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const result = await login(email, password)

    if (result.success && result.user) {
      if (result.must_change_password) {
        // Show forced password change modal
        setPendingUser(result.user)
        setShowChangePassword(true)
        setIsLoading(false)
        return
      }

      // Normal redirect based on user type
      redirectUser(result.user.type)
    } else {
      setError(result.error || "Erro ao fazer login")
    }

    setIsLoading(false)
  }

  const redirectUser = (userType: string) => {
    if (userType === "admin" || userType === "organizador") {
      router.push("/")
    } else if (userType === "membro") {
      router.push("/membros")
    } else {
      router.push("/trainees")
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeError("")

    if (newPassword.length < 6) {
      setChangeError("A senha deve ter pelo menos 6 caracteres")
      return
    }

    if (newPassword !== confirmPassword) {
      setChangeError("As senhas não coincidem")
      return
    }

    setIsChanging(true)

    const result = await changePassword(newPassword)

    if (result.success && pendingUser) {
      setShowChangePassword(false)
      setNewPassword("")
      setConfirmPassword("")
      redirectUser(pendingUser.type)
    } else {
      setChangeError(result.error || "Erro ao alterar senha")
    }

    setIsChanging(false)
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <LayoutGrid className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Gestão Comercial</h1>
            <p className="text-sm text-muted-foreground">Sistema de gestão de conteúdos</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="bg-card border-border">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-foreground">Entrar</CardTitle>
            <CardDescription className="text-muted-foreground">
              Digite suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground">Senha</Label>
                  <Link 
                    href="/recuperar-senha" 
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Modal: Alterar Senha no Primeiro Acesso */}
      <Dialog open={showChangePassword} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md bg-card border-border" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-foreground">Alterar Senha</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  É necessário alterar sua senha no primeiro acesso
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4 mt-2">
            {changeError && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{changeError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-foreground">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-foreground">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isChanging}>
              {isChanging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                "Alterar Senha e Continuar"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}

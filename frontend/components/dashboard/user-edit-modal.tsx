"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Pencil, Trash2, X, Save, Eye, EyeOff } from "lucide-react"

interface UserEditModalProps {
  user: {
    id: string
    name: string
    email: string
    cargo: string
    type: string
    eixo?: string
  }
  currentUserRole?: string // "admin" or "organizador"
  onSave: (data: {
    name: string
    email: string
    cargo: string
    type: string
    eixo?: string
    password?: string
  }) => void
  onDelete: () => void
}

type Cargo = "admin" | "organizador" | "membro" | "trainee"
type Eixo = "vendas" | "conexoes" | "experiencia"

export function UserEditModal({
  user,
  currentUserRole = "admin",
  onSave,
  onDelete,
}: UserEditModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState("")
  const [cargo, setCargo] = useState<Cargo>(user.cargo as Cargo)
  const [type, setType] = useState<string>(user.type)
  const [eixo, setEixo] = useState<Eixo | "">((user.eixo as Eixo) || "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)

  const isOrg = currentUserRole === "organizador"

  const handleSave = () => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = "Nome é obrigatório"
    }

    if (!email.trim()) {
      newErrors.email = "Email é obrigatório"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email inválido"
    }

    if (password && password.length < 6) {
      newErrors.password = "A senha deve ter no mínimo 6 caracteres"
    }

    if (type === "membro" && !eixo) {
      newErrors.eixo = "Eixo é obrigatório para membros"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSave({
      name: name.trim(),
      email: email.trim(),
      cargo: cargo,
      type: type,
      password: password || undefined,
      ...(type === "membro" && eixo ? { eixo: eixo as Eixo } : { eixo: undefined }),
    })
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Editar Usuário: {user.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nome */}
          <div className="space-y-1">
            <Label className="text-foreground">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary border-border"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <Label className="text-foreground">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary border-border"
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Senha (opcional) */}
          <div className="space-y-1">
            <Label className="text-foreground">Nova Senha (deixe em branco para não alterar)</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary border-border placeholder:text-muted-foreground pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          {/* Tipo e Cargo (Apenas Admin) */}
          {!isOrg ? (
            <>
              <div className="space-y-1">
                <Label className="text-foreground">Perfil (Tipo)</Label>
                <Select
                  value={type}
                  onValueChange={(val) => {
                    setType(val)
                    if (val === "trainee") {
                      setCargo("trainee")
                      setEixo("")
                    } else if (val === "organizador") {
                      setCargo("organizador")
                      setEixo("")
                    } else if (val === "admin") {
                      setCargo("admin")
                      setEixo("")
                    } else {
                      setCargo("membro")
                    }
                  }}
                >
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="organizador">Organizador (PlugInfo)</SelectItem>
                    <SelectItem value="membro">Membro</SelectItem>
                    <SelectItem value="trainee">Trainee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {type === "membro" && (
                <div className="space-y-1">
                  <Label className="text-foreground">Eixo</Label>
                  <Select value={eixo} onValueChange={(val: Eixo) => setEixo(val)}>
                    <SelectTrigger className="bg-secondary border-border text-foreground">
                      <SelectValue placeholder="Selecione o eixo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendas">Vendas</SelectItem>
                      <SelectItem value="conexoes">Conexões</SelectItem>
                      <SelectItem value="experiencia">Experiência do Consumidor</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.eixo && (
                    <p className="text-xs text-destructive">{errors.eixo}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-1">
              <Label className="text-foreground">Tipo / Cargo</Label>
              <Input value="Trainee" disabled className="bg-secondary border-border" />
            </div>
          )}
        </div>

        {/* Rodapé do Dialog */}
        <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
          {/* Botão de Excluir */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1.5">
                <Trash2 className="h-4 w-4" />
                Excluir Conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  Esta ação não pode ser desfeita. Isso excluirá permanentemente a conta de{" "}
                  <strong>{user.name}</strong>, incluindo todo o progresso na trilha e entregas de atividades.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete()
                    setIsOpen(false)
                  }}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  Confirmar Exclusão
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsOpen(false)} className="border-border">
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

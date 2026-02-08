"use client"

import React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserPlus, X } from "lucide-react"

type Cargo = "gerente" | "membro" | "trainee"
type Eixo = "vendas" | "conexoes" | "experiencia"

interface MemberFormData {
  name: string
  email: string
  cargo: Cargo
  eixo?: Eixo
}

interface MemberFormProps {
  onSubmit: (data: MemberFormData) => void
}

export function MemberForm({ onSubmit }: MemberFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cargo, setCargo] = useState<Cargo | "">("")
  const [eixo, setEixo] = useState<Eixo | "">("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setName("")
    setEmail("")
    setCargo("")
    setEixo("")
    setErrors({})
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = "Nome é obrigatório"
    }

    if (!email.trim()) {
      newErrors.email = "Email é obrigatório"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email inválido"
    }

    if (!cargo) {
      newErrors.cargo = "Cargo é obrigatório"
    }

    if ((cargo === "membro" || cargo === "gerente") && !eixo) {
      newErrors.eixo = "Eixo é obrigatório para membros e gerentes"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    const formData: MemberFormData = {
      name: name.trim(),
      email: email.trim(),
      cargo: cargo as Cargo,
      ...((cargo === "membro" || cargo === "gerente") && eixo ? { eixo: eixo as Eixo } : {}),
    }

    onSubmit(formData)
    resetForm()
    setOpen(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      resetForm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Cadastrar Membro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Cadastrar Novo Membro</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Preencha as informações para cadastrar um novo membro na equipe comercial.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Nome
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Cargo */}
          <div className="space-y-2">
            <Label htmlFor="cargo" className="text-foreground">
              Cargo
            </Label>
            <Select
              value={cargo}
              onValueChange={(value: Cargo) => {
                setCargo(value)
                if (value === "trainee") {
                  setEixo("")
                }
              }}
            >
              <SelectTrigger className="bg-secondary border-border text-foreground">
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="membro">Membro</SelectItem>
                <SelectItem value="trainee">Trainee</SelectItem>
              </SelectContent>
            </Select>
            {errors.cargo && (
              <p className="text-sm text-destructive">{errors.cargo}</p>
            )}
          </div>

          {/* Eixo - apenas se cargo for "membro" ou "gerente" */}
          {(cargo === "membro" || cargo === "gerente") && (
            <div className="space-y-2">
              <Label htmlFor="eixo" className="text-foreground">
                Eixo
              </Label>
              <Select
                value={eixo}
                onValueChange={(value: Eixo) => setEixo(value)}
              >
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
                <p className="text-sm text-destructive">{errors.eixo}</p>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button type="submit">
              Cadastrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

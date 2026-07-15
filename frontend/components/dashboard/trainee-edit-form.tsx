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
import { Pencil, X, Save } from "lucide-react"

interface TraineeEditFormProps {
  traineeId: string
  traineeName: string
  notaRotacao?: number
  onSave: (data: { notaRotacao?: number }) => void
}

export function TraineeEditForm({
  traineeId,
  traineeName,
  notaRotacao: initialNota,
  onSave,
}: TraineeEditFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notaRotacao, setNotaRotacao] = useState<string>(
    initialNota !== undefined ? initialNota.toString() : ""
  )

  const handleSave = () => {
    const nota = notaRotacao ? parseFloat(notaRotacao) : undefined
    onSave({
      notaRotacao: nota && !isNaN(nota) ? Math.min(10, Math.max(0, nota)) : undefined,
    })
    setIsOpen(false)
  }

  const handleCancel = () => {
    setNotaRotacao(initialNota !== undefined ? initialNota.toString() : "")
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
      <DialogContent className="sm:max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Editar Trainee: {traineeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nota da Rotação */}
          <div className="space-y-2">
            <Label htmlFor="nota" className="text-foreground">
              Nota da Rotação (0–10)
            </Label>
            <Input
              id="nota"
              type="number"
              min="0"
              max="10"
              step="0.1"
              placeholder="Ex: 8.5"
              value={notaRotacao}
              onChange={(e) => setNotaRotacao(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

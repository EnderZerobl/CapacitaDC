"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Pencil, Plus, Trash2, X, Save } from "lucide-react"
import { TraineeActivity } from "./trainee-card"

interface TraineeEditFormProps {
  traineeId: string
  traineeName: string
  notaRotacao?: number
  atividades: TraineeActivity[]
  onSave: (data: {
    notaRotacao?: number
    atividades: TraineeActivity[]
  }) => void
}

export function TraineeEditForm({
  traineeId,
  traineeName,
  notaRotacao: initialNota,
  atividades: initialAtividades,
  onSave,
}: TraineeEditFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notaRotacao, setNotaRotacao] = useState<string>(
    initialNota !== undefined ? initialNota.toString() : ""
  )
  const [atividades, setAtividades] = useState<TraineeActivity[]>(initialAtividades)
  const [newAtividadeName, setNewAtividadeName] = useState("")

  const handleAddAtividade = () => {
    if (newAtividadeName.trim()) {
      const newAtividade: TraineeActivity = {
        id: `atividade-${Date.now()}`,
        name: newAtividadeName.trim(),
        completed: false,
      }
      setAtividades([...atividades, newAtividade])
      setNewAtividadeName("")
    }
  }

  const handleRemoveAtividade = (id: string) => {
    setAtividades(atividades.filter((a) => a.id !== id))
  }

  const handleToggleAtividade = (id: string) => {
    setAtividades(
      atividades.map((a) =>
        a.id === id ? { ...a, completed: !a.completed } : a
      )
    )
  }

  const handleSave = () => {
    const nota = notaRotacao ? parseFloat(notaRotacao) : undefined
    onSave({
      notaRotacao: nota && !isNaN(nota) ? Math.min(10, Math.max(0, nota)) : undefined,
      atividades,
    })
    setIsOpen(false)
  }

  const handleCancel = () => {
    setNotaRotacao(initialNota !== undefined ? initialNota.toString() : "")
    setAtividades(initialAtividades)
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
            Editar Trainee: {traineeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nota da Rotação */}
          <div className="space-y-2">
            <Label htmlFor="nota" className="text-foreground">
              Nota da Rotação (0-10)
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

          {/* Atividades */}
          <div className="space-y-3">
            <Label className="text-foreground">Atividades</Label>
            
            {/* Adicionar nova atividade */}
            <div className="flex gap-2">
              <Input
                placeholder="Nome da atividade"
                value={newAtividadeName}
                onChange={(e) => setNewAtividadeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddAtividade()
                  }
                }}
                className="bg-secondary border-border"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddAtividade}
                className="shrink-0 bg-transparent"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Lista de atividades */}
            {atividades.length > 0 ? (
              <Card className="border-border bg-secondary/50">
                <CardContent className="p-3 space-y-2">
                  {atividades.map((atividade) => (
                    <div
                      key={atividade.id}
                      className="flex items-center gap-3 py-1"
                    >
                      <Checkbox
                        id={atividade.id}
                        checked={atividade.completed}
                        onCheckedChange={() => handleToggleAtividade(atividade.id)}
                      />
                      <label
                        htmlFor={atividade.id}
                        className={`flex-1 text-sm cursor-pointer ${
                          atividade.completed
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {atividade.name}
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveAtividade(atividade.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma atividade adicionada
              </p>
            )}
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

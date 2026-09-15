"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { nodesApi } from "@/features/nodes/api"
import type { TrainingNode } from "@/features/nodes/types"
import type { Activity } from "@/features/activities/types"
import type { Material } from "@/features/materials/types"

export function NodeActivityLink({ node, activities, materials, onSaved }: {
  node: TrainingNode
  activities: Activity[]
  materials: Material[]
  onSaved: () => Promise<void>
}) {
  const [activityId, setActivityId] = useState(node.activity_id || "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const activity = activities.find(item => item.id === activityId)
  const material = materials.find(item => item.id === activity?.material_id)
  const save = async () => {
    setBusy(true)
    setError("")
    try {
      await nodesApi.updateActivity(node.id, activityId)
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível vincular a atividade.")
    } finally { setBusy(false) }
  }
  return <div className="space-y-2 rounded-lg border border-border p-3">
    <Label htmlFor={`node-activity-${node.id}`}>Atividade do nó</Label>
    <select id={`node-activity-${node.id}`} value={activityId} disabled={busy}
      onChange={event => setActivityId(event.target.value)}
      className="h-9 w-full rounded-md border border-border bg-secondary px-2 text-xs">
      <option value="">Selecione uma atividade...</option>
      {activities.filter(item => item.eixo === node.eixo || item.eixo === "all").map(item =>
        <option key={item.id} value={item.id}>{item.title}</option>)}
    </select>
    <p className="text-xs text-muted-foreground">{material
      ? `Material da atividade: ${material.name}`
      : activity ? "Esta atividade não possui material disponível. Vincule um material ao editar a atividade."
      : "Vincule uma atividade para mostrar suas instruções e seu material nesta etapa."}</p>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <Button size="sm" variant="outline" disabled={busy || !activityId || (node.type === "activity" && activityId === node.activity_id)}
      onClick={() => void save()}>{busy ? "Salvando..." : "Salvar atividade do nó"}</Button>
  </div>
}

"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { newStep } from "@/features/games/drafts"
import type { ScenarioConfig, ScenarioStep } from "@/features/games/types"
import { EditorField, editorSelectClass } from "./editor-fields"

export function ScenarioEditor({ config, onChange }: { config: ScenarioConfig; onChange: (config: ScenarioConfig) => void }) {
  const update = (index: number, patch: Partial<ScenarioStep>) => onChange({ ...config, steps: config.steps.map((step, i) => i === index ? { ...step, ...patch } : step) })
  const remove = (id: string) => onChange({
    start_step_id: config.start_step_id === id ? "" : config.start_step_id,
    steps: config.steps.filter(step => step.id !== id).map(step => ({ ...step, options: step.options.map(option => option.next_step_id === id ? { ...option, next_step_id: null } : option) })),
  })
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">Cada decisão pode encerrar o jogo ou levar a outro passo. Todos os passos precisam ser alcançáveis, sem ciclos. A nota compara os pontos do caminho percorrido com o melhor caminho possível, em uma escala de 0 a 100.</p>
    <EditorField label="Passo inicial"><select className={editorSelectClass} value={config.start_step_id} onChange={event => onChange({ ...config, start_step_id: event.target.value })}><option value="">Selecione o início</option>{config.steps.map((step, index) => <option key={step.id} value={step.id}>Passo {index + 1}{step.text ? ` — ${step.text.slice(0, 55)}` : ""}</option>)}</select></EditorField>
    {config.steps.map((step, index) => <section key={step.id} className="space-y-4 rounded-lg border p-4" aria-label={`Passo ${index + 1}`}>
      <div className="flex items-center justify-between"><h3 className="font-semibold">Passo {index + 1}</h3><Button type="button" variant="ghost" size="icon" aria-label={`Excluir passo ${index + 1}`} onClick={() => remove(step.id)}><Trash2 className="size-4" /></Button></div>
      <EditorField label="Situação ou contexto"><Textarea value={step.text} onChange={event => update(index, { text: event.target.value })} /></EditorField>
      {step.options.map((option, optionIndex) => <div key={option.id} className="space-y-3 rounded-md bg-muted/40 p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1"><EditorField label={`Decisão ${optionIndex + 1}`}><Input value={option.text} onChange={event => update(index, { options: step.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} /></EditorField></div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Excluir decisão ${optionIndex + 1} do passo ${index + 1}`} onClick={() => update(index, { options: step.options.filter(item => item.id !== option.id) })}><Trash2 className="size-4" /></Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <EditorField label="Pontuação da decisão (0 a 100)"><Input type="number" min={0} max={100} step={1} value={option.score} onChange={event => update(index, { options: step.options.map(item => item.id === option.id ? { ...item, score: Number(event.target.value) } : item) })} /></EditorField>
          <EditorField label="Após esta decisão"><select className={editorSelectClass} value={option.next_step_id ?? ""} onChange={event => update(index, { options: step.options.map(item => item.id === option.id ? { ...item, next_step_id: event.target.value || null } : item) })}><option value="">Encerrar jogo</option>{config.steps.filter(item => item.id !== step.id).map(item => <option key={item.id} value={item.id}>Ir para passo {config.steps.indexOf(item) + 1}{item.text ? ` — ${item.text.slice(0, 35)}` : ""}</option>)}</select></EditorField>
        </div>
        <EditorField label="Consequência / feedback (opcional)"><Textarea rows={2} value={option.feedback} onChange={event => update(index, { options: step.options.map(item => item.id === option.id ? { ...item, feedback: event.target.value } : item) })} /></EditorField>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => update(index, { options: [...step.options, { id: crypto.randomUUID(), text: "", score: 0, feedback: "", next_step_id: null }] })}><Plus className="size-4" />Adicionar decisão</Button>
    </section>)}
    <Button type="button" variant="outline" onClick={() => {
      const step = newStep()
      onChange({ start_step_id: config.start_step_id || step.id, steps: [...config.steps, step] })
    }}><Plus className="size-4" />Adicionar passo</Button>
  </div>
}

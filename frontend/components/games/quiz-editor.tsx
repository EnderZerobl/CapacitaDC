"use client"

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { newQuestion } from "@/features/games/drafts"
import type { QuizConfig, QuizQuestion } from "@/features/games/types"
import { EditorField, editorSelectClass, moveItem } from "./editor-fields"

export function QuizEditor({ config, onChange }: { config: QuizConfig; onChange: (config: QuizConfig) => void }) {
  const update = (index: number, patch: Partial<QuizQuestion>) => onChange({ questions: config.questions.map((question, i) => i === index ? { ...question, ...patch } : question) })
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">Defina enunciados, alternativas e gabarito. A escolha múltipla exige selecionar todas as opções corretas, sem marcar as incorretas.</p>
    {config.questions.map((question, index) => <section key={question.id} className="space-y-4 rounded-lg border p-4" aria-label={`Pergunta ${index + 1}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Pergunta {index + 1}</h3>
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="ghost" aria-label={`Mover pergunta ${index + 1} para cima`} disabled={index === 0} onClick={() => onChange({ questions: moveItem(config.questions, index, -1) })}><ArrowUp className="size-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Mover pergunta ${index + 1} para baixo`} disabled={index === config.questions.length - 1} onClick={() => onChange({ questions: moveItem(config.questions, index, 1) })}><ArrowDown className="size-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Excluir pergunta ${index + 1}`} onClick={() => onChange({ questions: config.questions.filter(item => item.id !== question.id) })}><Trash2 className="size-4" /></Button>
        </div>
      </div>
      <EditorField label="Enunciado"><Textarea value={question.text} onChange={event => update(index, { text: event.target.value })} /></EditorField>
      <div className="grid gap-4 sm:grid-cols-2">
        <EditorField label="Modo de resposta"><select className={editorSelectClass} value={question.selection} onChange={event => {
          const selection = event.target.value as QuizQuestion["selection"]
          let keptCorrect = false
          const options = question.options.map(option => {
            const is_correct = option.is_correct && (selection === "multiple" || !keptCorrect)
            if (is_correct) keptCorrect = true
            return { ...option, is_correct }
          })
          update(index, { selection, options })
        }}><option value="single">Uma opção correta</option><option value="multiple">Várias opções corretas</option></select></EditorField>
        <EditorField label="Peso da pergunta (1 a 100)"><Input type="number" min={1} max={100} step={1} value={question.weight} onChange={event => update(index, { weight: Number(event.target.value) })} /></EditorField>
      </div>
      <div className="space-y-3">
        {question.options.map((option, optionIndex) => <div key={option.id} className="space-y-3 rounded-md bg-muted/40 p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1"><EditorField label={`Opção ${optionIndex + 1}`}><Input value={option.text} onChange={event => update(index, { options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} /></EditorField></div>
            <Button type="button" variant="ghost" size="icon" aria-label={`Excluir opção ${optionIndex + 1} da pergunta ${index + 1}`} onClick={() => update(index, { options: question.options.filter(item => item.id !== option.id) })}><Trash2 className="size-4" /></Button>
          </div>
          <label className="flex items-center gap-2 text-sm"><input className="size-4 accent-primary" type={question.selection === "single" ? "radio" : "checkbox"} name={`correct-${question.id}`} checked={option.is_correct} onChange={event => update(index, { options: question.options.map(item => item.id === option.id ? { ...item, is_correct: event.target.checked } : question.selection === "single" ? { ...item, is_correct: false } : item) })} />Resposta correta</label>
          <EditorField label="Feedback desta opção (opcional)"><Textarea rows={2} value={option.feedback} onChange={event => update(index, { options: question.options.map(item => item.id === option.id ? { ...item, feedback: event.target.value } : item) })} /></EditorField>
        </div>)}
        <Button type="button" variant="outline" size="sm" onClick={() => update(index, { options: [...question.options, { id: crypto.randomUUID(), text: "", is_correct: false, feedback: "" }] })}><Plus className="size-4" />Adicionar opção</Button>
      </div>
      <EditorField label="Explicação do gabarito (opcional)"><Textarea rows={2} value={question.explanation} onChange={event => update(index, { explanation: event.target.value })} /></EditorField>
    </section>)}
    <Button type="button" variant="outline" onClick={() => onChange({ questions: [...config.questions, newQuestion()] })}><Plus className="size-4" />Adicionar pergunta</Button>
  </div>
}

"use client"

import { Button } from "@/components/ui/button"
import type { GameResult, PublicQuestion, PublicStep } from "@/features/games/types"

export function QuizChoices({ questions, answers, onChange, disabled }: { questions: PublicQuestion[]; answers: Record<string, string[]>; onChange: (questionId: string, optionIds: string[]) => void; disabled?: boolean }) {
  return <div className="space-y-6">{questions.map((question, index) => <fieldset key={question.id} disabled={disabled} className="space-y-3 rounded-lg border p-4">
    <legend className="px-1 text-sm font-semibold">Pergunta {index + 1}</legend>
    <p className="whitespace-pre-wrap font-medium">{question.text}</p>
    <p className="text-xs text-muted-foreground">{question.selection === "multiple" ? "Selecione todas as opções corretas." : "Selecione uma opção."}</p>
    {question.options.map(option => <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
      <input type={question.selection === "multiple" ? "checkbox" : "radio"} name={`answer-${question.id}`} className="mt-0.5 size-4 shrink-0 accent-primary" checked={(answers[question.id] || []).includes(option.id)} onChange={event => onChange(question.id, question.selection === "single" ? [option.id] : event.target.checked ? [...(answers[question.id] || []), option.id] : (answers[question.id] || []).filter(id => id !== option.id))} />
      <span className="whitespace-pre-wrap">{option.text}</span>
    </label>)}
  </fieldset>)}</div>
}

export function ScenarioChoices({ step, onSelect, disabled }: { step: PublicStep; onSelect: (optionId: string) => void; disabled?: boolean }) {
  return <div className="space-y-4">
    <p className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-medium">{step.text}</p>
    <p className="text-sm text-muted-foreground">Escolha uma decisão para continuar.</p>
    <div className="grid gap-3">{step.options.map(option => <Button key={option.id} type="button" variant="outline" disabled={disabled} className="h-auto justify-start whitespace-pre-wrap p-4 text-left" onClick={() => onSelect(option.id)}>{option.text}</Button>)}</div>
  </div>
}

export function GameResultView({ result, preview = false }: { result: GameResult; preview?: boolean }) {
  return <div className="space-y-5">
    <div className="rounded-xl bg-primary/5 p-5 text-center">
      <h3 className="text-lg font-semibold">{preview ? "Resultado da prévia" : "Jogo concluído"}</h3>
      <p className="mt-2 text-3xl font-bold text-primary">{result.attempt_score} <span className="text-base font-normal text-muted-foreground">/ {result.max_score} pontos</span></p>
      {!preview && <p className="mt-2 text-sm text-muted-foreground">Melhor resultado nesta etapa: {result.total_score}. Pontos adicionados: {result.score_added}.</p>}
    </div>
    {result.note && <p className="whitespace-pre-wrap rounded-lg border p-4 text-sm">{result.note}</p>}
    <div className="space-y-3">{result.feedback.map((item, index) => <section key={item.question_id || item.step_id || item.item_id || index} className="space-y-2 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4"><p className="whitespace-pre-wrap text-sm font-medium">{item.text}</p><span className="shrink-0 text-sm text-muted-foreground">{item.score} / {item.max_score}</span></div>
      {typeof item.is_correct === "boolean" && <p className={`text-sm font-medium ${item.is_correct ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>{item.is_correct ? "Resposta correta" : "Revise sua resposta"}</p>}
      {item.feedback && <p className="whitespace-pre-wrap text-sm">{item.feedback}</p>}
      {item.explanation && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.explanation}</p>}
    </section>)}</div>
  </div>
}

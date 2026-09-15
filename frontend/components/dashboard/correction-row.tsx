"use client"

import { useState } from "react"
import { Link2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ActivitySubmissionOut } from "@/features/activities/types"

interface CorrectionRowProps {
  submission: ActivitySubmissionOut
  /** Mostra atividade e pessoa; desnecessário dentro da própria atividade. */
  showContext?: boolean
  onGrade: (grade: number, feedback: string) => Promise<unknown>
}

export function CorrectionRow({ submission, showContext = false, onGrade }: CorrectionRowProps) {
  const [grade, setGrade] = useState(submission.grade?.toString() ?? "")
  const [feedback, setFeedback] = useState(submission.feedback ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const save = async () => {
    const value = Number(grade.replace(",", "."))
    if (!grade.trim() || Number.isNaN(value) || value < 0 || value > 10) {
      setError("Informe uma nota entre 0 e 10.")
      return
    }
    setBusy(true)
    setError("")
    try {
      await onGrade(value, feedback)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a nota.")
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-2 rounded-lg border border-border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-semibold text-foreground">{submission.user_name}</span>
      {submission.submitted_at && (
        <span className="text-[10px] text-muted-foreground">
          {new Date(submission.submitted_at).toLocaleString("pt-BR")}
        </span>
      )}
    </div>
    {showContext && (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-foreground">{submission.activity_title}</span>
        {submission.activity_weight != null && <Badge variant="outline" className="text-[10px]">peso {submission.activity_weight}</Badge>}
        {submission.user_type && <Badge variant="secondary" className="text-[10px]">{submission.user_type}</Badge>}
        {submission.grade == null && <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Pendente</Badge>}
      </div>
    )}
    {submission.file_url && (
      <a href={submission.file_url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1 truncate text-xs text-primary hover:underline">
        <Link2 className="h-3 w-3" />{submission.file_url}
      </a>
    )}
    {submission.comment && <p className="text-xs italic text-muted-foreground">{submission.comment}</p>}
    <div className="flex items-center gap-2">
      <Input aria-label="Nota de 0 a 10" placeholder="Nota (0-10)" value={grade} disabled={busy}
        onChange={event => setGrade(event.target.value)}
        className="h-7 w-24 border-border bg-secondary text-xs" />
      <Input aria-label="Feedback" placeholder="Feedback" value={feedback} disabled={busy}
        onChange={event => setFeedback(event.target.value)}
        className="h-7 flex-1 border-border bg-secondary text-xs" />
      <Button size="sm" className="h-7 px-3 text-xs" disabled={busy} onClick={() => void save()}>
        {busy ? "Salvando…" : "Salvar"}
      </Button>
    </div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {submission.grade != null && (
      <p className="text-xs font-semibold text-emerald-400">Nota atual: {submission.grade.toFixed(1)}</p>
    )}
  </div>
}

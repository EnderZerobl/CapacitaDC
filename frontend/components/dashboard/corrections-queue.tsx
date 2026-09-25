"use client"

import { ClipboardCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSubmissionQueue } from "@/features/activities/hooks"
import type { Activity } from "@/features/activities/types"
import { CorrectionRow } from "./correction-row"
import { memberAxisLabels, type MemberAxis } from "@/lib/roles"

const selectClass = "h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground"

interface CorrectionsQueueProps {
  activities: Activity[]
  isOrganizer: boolean
  /** O gerente corrige só membros do próprio eixo; os filtros refletem isso. */
  managerAxis?: MemberAxis | null
  /** A média ponderada muda no servidor a cada nota, então a planilha recarrega. */
  onGraded?: () => void
}

export function CorrectionsQueue({ activities, isOrganizer, managerAxis = null, onGraded }: CorrectionsQueueProps) {
  const { items, filters, setFilters, setPage, pageSize, hasMore, loading, error, refresh, grade, remove } = useSubmissionQueue()
  const axes = managerAxis ? [{ value: managerAxis, label: memberAxisLabels[managerAxis] }] : isOrganizer
    ? [{ value: "trainee", label: "Trainee" }]
    : [{ value: "trainee", label: "Trainee" }, { value: "vendas", label: "Vendas" },
       { value: "conexoes", label: "Conexões" }, { value: "experiencia", label: "Experiência" },
       { value: "all", label: "Todos os eixos" }]

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Situação" className={selectClass} value={filters.status ?? "all"}
        onChange={event => setFilters({ ...filters, status: event.target.value as typeof filters.status })}>
        <option value="pending">Pendentes</option>
        <option value="graded">Corrigidas</option>
        <option value="all">Todas</option>
      </select>
      {!isOrganizer && !managerAxis && (
        <select aria-label="Tipo de pessoa" className={selectClass} value={filters.user_type ?? "all"}
          onChange={event => setFilters({ ...filters, user_type: event.target.value as typeof filters.user_type })}>
          <option value="all">Trainees e membros</option>
          <option value="trainee">Trainees</option>
          <option value="membro">Membros</option>
        </select>
      )}
      <select aria-label="Eixo" className={selectClass} value={filters.eixo ?? ""}
        onChange={event => setFilters({ ...filters, eixo: event.target.value || undefined })}>
        <option value="">Todos os eixos</option>
        {axes.map(axis => <option key={axis.value} value={axis.value}>{axis.label}</option>)}
      </select>
      <select aria-label="Atividade" className={`${selectClass} max-w-xs`} value={filters.activity_id ?? ""}
        onChange={event => setFilters({ ...filters, activity_id: event.target.value || undefined })}>
        <option value="">Todas as atividades</option>
        {activities.filter(activity => !isOrganizer || activity.eixo === "trainee").map(activity => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
      </select>
      <Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>Atualizar</Button>
    </div>

    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

    {loading ? (
      <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />Carregando envios…
      </p>
    ) : items.length === 0 ? (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <ClipboardCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Nenhum envio neste filtro</p>
        <p className="mt-1 text-xs text-muted-foreground">Quando alguém entregar uma atividade, o envio aparece aqui.</p>
      </div>
    ) : (
      <div className="space-y-3">
        {items.map(submission => (
          <CorrectionRow key={submission.id} submission={submission} showContext
            onGrade={async (value, feedback) => {
              await grade(submission.activity_id, submission.id, value, feedback)
              onGraded?.()
            }}
            onDelete={async () => {
              await remove(submission.activity_id, submission.id)
              onGraded?.()
            }} />
        ))}
      </div>
    )}
    <nav aria-label="Páginas de envios" className="flex items-center justify-between gap-3">
      <Button variant="outline" disabled={loading || !filters.offset} onClick={() => setPage((filters.offset || 0) - pageSize)}>Anterior</Button>
      <span className="text-sm text-muted-foreground">Página {Math.floor((filters.offset || 0) / pageSize) + 1}</span>
      <Button variant="outline" disabled={loading || !hasMore} onClick={() => setPage((filters.offset || 0) + pageSize)}>Próxima</Button>
    </nav>
  </div>
}

"use client"

import { useId, useState } from "react"
import { Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { activitiesApi } from "@/features/activities/api"
import type { Activity, SubmissionAttachment } from "@/features/activities/types"

const EXTENSIONS = ["pdf", "doc", "docx", "odt", "xls", "xlsx", "ods", "ppt", "pptx", "odp", "png", "jpg", "jpeg", "gif", "webp", "zip", "txt", "csv"]

export function ActivitySubmissionForm({ activity, nodeId, onSubmitted }: {
  activity: Activity
  nodeId?: string
  onSubmitted: () => Promise<void>
}) {
  const id = useId()
  const initial = activity.my_submission
  const [attachments, setAttachments] = useState<SubmissionAttachment[]>(initial?.attachments || [])
  const [links, setLinks] = useState([...(initial?.links || []), ...(initial?.file_url ? [initial.file_url] : [])].join("\n"))
  const [comment, setComment] = useState(initial?.comment || "")
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const busy = uploading || submitting
  const addFiles = async (files: File[]) => {
    setError("")
    if (attachments.length + files.length > 5) { setError("Envie no máximo 5 anexos por atividade."); return }
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) { setError(`${file.name}: o limite é de 20 MB por arquivo.`); return }
      if (!file.size) { setError(`${file.name}: o arquivo está vazio.`); return }
      if (!EXTENSIONS.includes(file.name.split(".").pop()?.toLowerCase() || "")) { setError(`${file.name}: formato não permitido.`); return }
    }
    setUploading(true)
    try {
      for (const file of files) {
        const uploaded = await activitiesApi.uploadAttachment(activity.id, file, nodeId)
        setAttachments(previous => [...previous, uploaded])
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível enviar o anexo.") }
    finally { setUploading(false) }
  }
  const submit = async () => {
    setError("")
    const urls = links.split("\n").map(link => link.trim()).filter(Boolean)
    if (urls.length > 10) { setError("Informe no máximo 10 links."); return }
    if (urls.some(link => { try { return !["http:", "https:"].includes(new URL(link).protocol) } catch { return true } })) {
      setError("Informe links válidos começando com http:// ou https://."); return
    }
    setSubmitting(true)
    try {
      await activitiesApi.submit(activity.id, { node_id: nodeId, attachment_ids: attachments.map(file => file.id), links: urls, comment })
      await onSubmitted()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível enviar a atividade.") }
    finally { setSubmitting(false) }
  }
  return <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor={`${id}-files`}>Anexos {activity.accepts_file ? "(obrigatório)" : "(opcional)"}</Label>
      <Input id={`${id}-files`} type="file" multiple disabled={busy || attachments.length >= 5}
        accept={EXTENSIONS.map(extension => `.${extension}`).join(",")}
        aria-describedby={`${id}-limits`}
        onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; void addFiles(files) }} />
      <p id={`${id}-limits`} className="text-xs text-muted-foreground">Até 5 arquivos, com 20 MB cada. PDF, documentos, planilhas, apresentações, imagens, TXT, CSV e ZIP.</p>
      {attachments.map(file => <div key={file.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
        <span className="break-all">{file.name}</span>
        <Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={`Remover ${file.name}`}
          onClick={() => setAttachments(previous => previous.filter(item => item.id !== file.id))}><X className="size-4" /></Button>
      </div>)}
      {uploading && <p role="status" className="text-xs text-muted-foreground">Enviando anexos...</p>}
    </div>
    <div className="space-y-1">
      <Label htmlFor={`${id}-links`}>Links (opcional)</Label>
      <Textarea id={`${id}-links`} placeholder="https://... (um link por linha)" value={links} disabled={busy} maxLength={20480}
        onChange={event => setLinks(event.target.value)} className="min-h-16" />
      <p className="text-xs text-muted-foreground">Até 10 links, um por linha.</p>
    </div>
    <div className="space-y-1">
      <Label htmlFor={`${id}-comment`}>Comentários (opcional)</Label>
      <Textarea id={`${id}-comment`} placeholder="Adicione observações..." value={comment} disabled={busy} maxLength={5000}
        onChange={event => setComment(event.target.value)} />
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" className="w-full gap-2" disabled={busy || (activity.accepts_file && !attachments.length) || (!attachments.length && !links.trim() && !comment.trim())}
      onClick={() => void submit()}><Upload className="size-4" />{submitting ? "Enviando..." : nodeId ? "Enviar atividade e concluir etapa" : initial ? "Atualizar envio" : "Enviar atividade"}</Button>
  </div>
}

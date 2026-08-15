"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, FileText, Video, Plus, Trash2, Upload, Loader2, Paperclip } from "lucide-react"

export interface ContentItem {
  id: string
  name: string
  type: "membro" | "trainee" | "pluginfo"
  eixo: string
  text?: string
  documents?: { name: string; url: string }[]
  videos?: string[]
}

interface ContentCardProps {
  content: ContentItem
  onClose: () => void
  onSave: (content: ContentItem) => void
  userType?: string
}

export function ContentCard({ content, onClose, onSave, userType = "admin" }: ContentCardProps) {
  const [editedContent, setEditedContent] = useState<ContentItem>(content)
  const [newVideo, setNewVideo] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (userType === "organizador") {
      setEditedContent(prev => ({
        ...prev,
        type: "trainee",
        eixo: "trainee"
      }))
    }
  }, [userType])

  const handleSave = () => {
    onSave(editedContent)
    onClose()
  }

  // ---------- File upload ----------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadError("")

    const token = localStorage.getItem("token")
    const uploaded: { name: string; url: string }[] = []

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append("file", file)

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          setUploadError(err.detail || "Erro ao fazer upload do arquivo.")
          break
        }

        const data = await res.json()
        uploaded.push({ name: data.name, url: data.url })
      } catch {
        setUploadError("Erro de conexão ao fazer upload.")
        break
      }
    }

    if (uploaded.length > 0) {
      setEditedContent(prev => ({
        ...prev,
        documents: [...(prev.documents || []), ...uploaded],
      }))
    }

    setUploading(false)
    // Reset input so the same file can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeDocument = (index: number) => {
    setEditedContent({
      ...editedContent,
      documents: editedContent.documents?.filter((_, i) => i !== index),
    })
  }

  // ---------- Videos ----------
  const addVideo = () => {
    if (newVideo) {
      setEditedContent({
        ...editedContent,
        videos: [...(editedContent.videos || []), newVideo],
      })
      setNewVideo("")
    }
  }

  const removeVideo = (index: number) => {
    setEditedContent({
      ...editedContent,
      videos: editedContent.videos?.filter((_, i) => i !== index),
    })
  }

  return (
    <Card className="border-primary/30 bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg text-foreground">
          {content.id.startsWith("content-new-") ? "Adicionar Conteúdo" : "Editar Conteúdo"}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Nome do Conteúdo */}
        <div className="space-y-2">
          <Label htmlFor="content-name">Nome do Conteúdo</Label>
          <Input
            id="content-name"
            value={editedContent.name}
            onChange={(e) =>
              setEditedContent({ ...editedContent, name: e.target.value })
            }
            placeholder="Digite o nome do conteúdo"
          />
        </div>

        {/* Tipo de Conteúdo */}
        {userType !== "organizador" ? (
          <div className="space-y-2">
            <Label>Tipo de Conteúdo</Label>
            <Select
              value={editedContent.type}
              onValueChange={(value: "membro" | "trainee" | "pluginfo") => {
                setEditedContent({
                  ...editedContent,
                  type: value,
                  eixo: value === "trainee" ? "trainee" : "vendas"
                })
              }}
            >
              <SelectTrigger className="bg-secondary text-foreground border-border">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="membro">Membro</SelectItem>
                <SelectItem value="trainee">Trainee</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Tipo de Conteúdo</Label>
            <Input value="Trainee" disabled className="bg-secondary border-border" />
          </div>
        )}

        {/* Eixo */}
        {userType !== "organizador" ? (
          editedContent.type === "membro" ? (
            <div className="space-y-2">
              <Label>Eixo de Comercial</Label>
              <Select
                value={editedContent.eixo}
                onValueChange={(value) =>
                  setEditedContent({ ...editedContent, eixo: value })
                }
              >
                <SelectTrigger className="bg-secondary text-foreground border-border">
                  <SelectValue placeholder="Selecione o eixo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendas">Vendas</SelectItem>
                  <SelectItem value="conexoes">Conexões</SelectItem>
                  <SelectItem value="experiencia">Experiência do Consumidor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Eixo de Comercial</Label>
              <Input value="Trainee" disabled className="bg-secondary border-border" />
            </div>
          )
        ) : (
          <div className="space-y-2">
            <Label>Eixo de Comercial</Label>
            <Input value="Trainee" disabled className="bg-secondary border-border" />
          </div>
        )}

        {/* Texto */}
        <div className="space-y-2">
          <Label htmlFor="content-text" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Texto
          </Label>
          <Textarea
            id="content-text"
            value={editedContent.text || ""}
            onChange={(e) =>
              setEditedContent({ ...editedContent, text: e.target.value })
            }
            placeholder="Digite o conteúdo de texto..."
            rows={4}
          />
        </div>

        {/* Documentos — upload real */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Anexo de Documentos
          </Label>

          {/* Lista dos documentos já anexados */}
          <div className="space-y-2">
            {editedContent.documents?.map((doc, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-muted rounded-lg"
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm truncate text-primary hover:underline"
                  title={doc.name}
                >
                  {doc.name}
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => removeDocument(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Botão de upload */}
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.zip,.txt,.csv"
              className="hidden"
              onChange={handleFileChange}
              id="doc-upload-input"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Selecionar arquivo(s) — PDF, Word, Excel, PPT, imagens...
                </>
              )}
            </Button>
            {uploadError && (
              <p className="text-xs text-destructive">{uploadError}</p>
            )}
          </div>
        </div>

        {/* Vídeos */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Links de Vídeos
          </Label>
          <div className="space-y-2">
            {editedContent.videos?.map((video, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-muted rounded-lg"
              >
                <Video className="h-4 w-4 text-primary" />
                <span className="flex-1 text-sm truncate">{video}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeVideo(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="URL do vídeo (YouTube, Vimeo, etc.)"
              value={newVideo}
              onChange={(e) => setNewVideo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addVideo()}
              className="flex-1 text-xs"
            />
            <Button variant="outline" size="icon" onClick={addVideo}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={uploading}>Salvar Alterações</Button>
        </div>
      </CardContent>
    </Card>
  )
}

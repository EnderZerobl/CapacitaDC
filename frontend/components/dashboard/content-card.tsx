"use client"

import { useState } from "react"
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
import { X, FileText, Link as LinkIcon, Video, Plus, Trash2 } from "lucide-react"

export interface ContentItem {
  id: string
  name: string
  type: "membro" | "trainee"
  eixo: string
  text?: string
  documents?: { name: string; url: string }[]
  videos?: string[]
}

interface ContentCardProps {
  content: ContentItem
  onClose: () => void
  onSave: (content: ContentItem) => void
}

export function ContentCard({ content, onClose, onSave }: ContentCardProps) {
  const [editedContent, setEditedContent] = useState<ContentItem>(content)
  const [newDocument, setNewDocument] = useState({ name: "", url: "" })
  const [newVideo, setNewVideo] = useState("")

  const handleSave = () => {
    onSave(editedContent)
    onClose()
  }

  const addDocument = () => {
    if (newDocument.name && newDocument.url) {
      setEditedContent({
        ...editedContent,
        documents: [...(editedContent.documents || []), newDocument],
      })
      setNewDocument({ name: "", url: "" })
    }
  }

  const removeDocument = (index: number) => {
    setEditedContent({
      ...editedContent,
      documents: editedContent.documents?.filter((_, i) => i !== index),
    })
  }

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
        <CardTitle className="text-lg text-foreground">Editar Conteúdo</CardTitle>
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
        <div className="space-y-2">
          <Label>Tipo de Conteúdo</Label>
          <Select
            value={editedContent.type}
            onValueChange={(value: "membro" | "trainee") =>
              setEditedContent({ ...editedContent, type: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="membro">Membro</SelectItem>
              <SelectItem value="trainee">Trainee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Eixo */}
        <div className="space-y-2">
          <Label>Eixo de Comercial</Label>
          <Select
            value={editedContent.eixo}
            onValueChange={(value) =>
              setEditedContent({ ...editedContent, eixo: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o eixo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vendas">Vendas</SelectItem>
              <SelectItem value="conexoes">Conexões</SelectItem>
              <SelectItem value="experiencia">Experiência do Consumidor</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

        {/* Documentos */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Anexo de Documentos
          </Label>
          <div className="space-y-2">
            {editedContent.documents?.map((doc, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-muted rounded-lg"
              >
                <FileText className="h-4 w-4 text-primary" />
                <span className="flex-1 text-sm truncate">{doc.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeDocument(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nome do documento"
              value={newDocument.name}
              onChange={(e) =>
                setNewDocument({ ...newDocument, name: e.target.value })
              }
              className="flex-1"
            />
            <Input
              placeholder="URL do documento"
              value={newDocument.url}
              onChange={(e) =>
                setNewDocument({ ...newDocument, url: e.target.value })
              }
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={addDocument}>
              <Plus className="h-4 w-4" />
            </Button>
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
              className="flex-1"
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
          <Button onClick={handleSave}>Salvar Alterações</Button>
        </div>
      </CardContent>
    </Card>
  )
}

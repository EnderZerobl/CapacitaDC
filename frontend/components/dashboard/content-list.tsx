"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ContentCard, ContentItem } from "./content-card"
import { Plus, Edit, FileText, Video, Search } from "lucide-react"

interface ContentListProps {
  contents: ContentItem[]
  onUpdateContent: (content: ContentItem) => void
  onAddContent: (content: ContentItem) => void
}

export function ContentList({
  contents,
  onUpdateContent,
  onAddContent,
}: ContentListProps) {
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")

  const filteredContents = contents.filter((content) => {
    const matchesSearch = content.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || content.type === filterType
    return matchesSearch && matchesType
  })

  const handleAddNew = () => {
    const newContent: ContentItem = {
      id: `content-${Date.now()}`,
      name: "Novo Conteúdo",
      type: "membro",
      eixo: "vendas",
      text: "",
      documents: [],
      videos: [],
    }
    setEditingContent(newContent)
    setIsAdding(true)
  }

  const handleSave = (content: ContentItem) => {
    if (isAdding) {
      onAddContent(content)
    } else {
      onUpdateContent(content)
    }
    setEditingContent(null)
    setIsAdding(false)
  }

  const handleClose = () => {
    setEditingContent(null)
    setIsAdding(false)
  }

  return (
    <div className="space-y-6">
      {/* Header com busca e filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conteúdo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="membro">Membros</SelectItem>
              <SelectItem value="trainee">Trainees</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAddNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Conteúdo
        </Button>
      </div>

      {/* Card de edição expandido */}
      {editingContent && (
        <ContentCard
          content={editingContent}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}

      {/* Lista de conteúdos */}
      <div className="grid gap-3">
        {filteredContents.map((content) => (
          <Card
            key={content.id}
            className="border-border/50 bg-card hover:border-primary/30 transition-all duration-200"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">
                        {content.name}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                          content.type === "membro"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {content.type === "membro" ? "Membro" : "Trainee"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="capitalize">{content.eixo}</span>
                      {content.documents && content.documents.length > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {content.documents.length} doc(s)
                        </span>
                      )}
                      {content.videos && content.videos.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Video className="h-3 w-3" />
                          {content.videos.length} vídeo(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setEditingContent(content)
                    setIsAdding(false)
                  }}
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredContents.length === 0 && (
          <Card className="border-dashed border-border/50 bg-transparent">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchTerm || filterType !== "all"
                  ? "Nenhum conteúdo encontrado com os filtros aplicados."
                  : "Nenhum conteúdo cadastrado. Clique em \"Adicionar Conteúdo\" para começar."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
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
import { Plus, Search, Edit2, Trash } from "lucide-react"

interface ContentListProps {
  contents: ContentItem[]
  onUpdateContent: (content: ContentItem) => void
  onAddContent: (content: ContentItem) => void
  onDeleteContent: (id: string) => void
  userType?: string
}

export function ContentList({
  contents,
  onUpdateContent,
  onAddContent,
  onDeleteContent,
  userType = "admin"
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
    const isOrg = userType === "organizador"
    const newContent: ContentItem = {
      id: `content-new-${Date.now()}`,
      name: "Novo Conteúdo",
      type: isOrg ? "pluginfo" : "membro",
      eixo: isOrg ? "pluginfo" : "vendas",
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
      {editingContent ? (
        <ContentCard
          content={editingContent}
          onClose={handleClose}
          onSave={handleSave}
          userType={userType}
        />
      ) : (
        <>
          {/* Header com busca e filtros */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-1 gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar conteúdo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-secondary text-foreground border-border placeholder:text-muted-foreground"
                />
              </div>
              {userType !== "organizador" && (
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px] bg-secondary text-foreground border-border">
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="membro">Membros</SelectItem>
                    <SelectItem value="trainee">Trainees</SelectItem>
                    <SelectItem value="pluginfo">PlugInfo</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={handleAddNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Conteúdo
            </Button>
          </div>

          {/* Grid de Conteúdos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContents.map((content) => (
              <div
                key={content.id}
                className="flex flex-col justify-between p-5 rounded-2xl border-2 border-border bg-card hover:border-primary/30 transition-all duration-200"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                      {content.type}
                    </span>
                    <span className="text-[10px] bg-secondary text-muted-foreground border border-border px-2 py-0.5 rounded-full uppercase font-semibold">
                      {content.eixo}
                    </span>
                  </div>
                  <h4 className="font-bold text-foreground line-clamp-1">{content.name}</h4>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                    {content.text || "Sem conteúdo de texto."}
                  </p>
                </div>
                <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDeleteContent(content.id)}
                  >
                    <Trash className="w-3.5 h-3.5 mr-1" /> Excluir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-border"
                    onClick={() => setEditingContent(content)}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filteredContents.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl text-muted-foreground text-sm">
              Nenhum conteúdo encontrado.
            </div>
          )}
        </>
      )}
    </div>
  )
}

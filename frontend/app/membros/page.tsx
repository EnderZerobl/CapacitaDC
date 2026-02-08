"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { contentData, eixoLabels, type Eixo, type ContentItem } from "@/lib/content-data"
import { ViewContentCard } from "@/components/content/view-content-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  LayoutGrid,
  Search,
  LogOut,
  Filter,
  User,
  BookOpen,
} from "lucide-react"

export default function MembrosPage() {
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEixo, setSelectedEixo] = useState<string>("all")

  // Filter contents - members can see both membro and trainee content
  const filteredContents = useMemo(() => {
    return contentData.filter((content) => {
      const matchesSearch = content.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesEixo =
        selectedEixo === "all" || content.eixo === selectedEixo
      return matchesSearch && matchesEixo
    })
  }, [searchQuery, selectedEixo])

  const membroContents = filteredContents.filter((c) => c.type === "membro")
  const traineeContents = filteredContents.filter((c) => c.type === "trainee")

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <LayoutGrid className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Portal do Membro
                </h1>
                <p className="text-sm text-muted-foreground">
                  Conteúdos Comerciais
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.name}</span>
                  <Badge variant="outline" className="text-primary border-primary/30">
                    Membro
                  </Badge>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Search Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Pesquisa</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome do conteúdo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <Select value={selectedEixo} onValueChange={setSelectedEixo}>
              <SelectTrigger className="w-full sm:w-48 bg-input border-border text-foreground">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filtrar por eixo" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all" className="text-foreground">
                  Todos os eixos
                </SelectItem>
                {(Object.keys(eixoLabels) as Eixo[]).map((eixo) => (
                  <SelectItem key={eixo} value={eixo} className="text-foreground">
                    {eixoLabels[eixo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Contents Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Conteúdos</h2>
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
              {filteredContents.length} encontrados
            </Badge>
          </div>

          {/* Member Contents */}
          {membroContents.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Conteúdos de Membro
              </h3>
              <div className="grid gap-4">
                {membroContents.map((content) => (
                  <ViewContentCard key={content.id} content={content} />
                ))}
              </div>
            </div>
          )}

          {/* Trainee Contents */}
          {traineeContents.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Conteúdos de Trainee
              </h3>
              <div className="grid gap-4">
                {traineeContents.map((content) => (
                  <ViewContentCard key={content.id} content={content} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredContents.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhum conteúdo encontrado
              </h3>
              <p className="text-sm text-muted-foreground">
                Tente ajustar sua pesquisa ou filtros
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

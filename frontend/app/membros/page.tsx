"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { type ContentItem } from "@/lib/content-data"
import { ViewContentCard } from "@/components/content/view-content-card"
import { TrainingPath } from "@/components/dashboard/training-path"
import { SpinGame } from "@/components/games/spin-game"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import {
  LayoutGrid,
  Search,
  LogOut,
  User,
  BookOpen,
  Trophy,
  Compass,
  FileText,
  Video,
  ExternalLink,
  Award
} from "lucide-react"

interface LeaderboardEntry {
  id: string
  name: string
  email: string
  cargo: string
  type: string
  eixo?: string
  pontos_acumulados: number
}

export default function MembrosPage() {
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()
  
  // Data states
  const [contents, setContents] = useState<ContentItem[]>([])
  const [nodes, setNodes] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  
  // UI states
  const [activeTab, setActiveTab] = useState("trilhas")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [isPlayingGame, setIsPlayingGame] = useState(false)
  const [isReadingMaterial, setIsReadingMaterial] = useState(false)

  const fetchData = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      // 1. Fetch Materials
      const matRes = await fetch("/api/materials", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (matRes.ok) {
        const matData = await matRes.json()
        const mapped = matData.map((m: any) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          eixo: m.eixo,
          text: m.text,
          documents: m.documents || [],
          videos: (m.videos || []).map((v: any) => v.url)
        }))
        setContents(mapped)
      }

      // 2. Fetch Training Nodes (Graph)
      const nodesRes = await fetch("/api/nodes", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (nodesRes.ok) {
        const nodesData = await nodesRes.json()
        setNodes(nodesData)
      }

      // 3. Fetch Leaderboard
      const leaderboardRes = await fetch("/api/leaderboard", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json()
        setLeaderboard(leaderboardData)
      }
    } catch (e) {
      console.error("Erro ao carregar dados do portal:", e)
    }
  }

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login")
      } else if (user.type === "trainee") {
        router.push("/trainees")
      } else {
        fetchData()
      }
    }
  }, [user, isLoading, router])

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  // Node selection triggers game or material view
  const handleSelectNode = (node: any) => {
    setSelectedNode(node)
    if (node.type === "game") {
      setIsPlayingGame(true)
    } else {
      setIsReadingMaterial(true)
    }
  }

  // Submit Game points
  const handleGameComplete = async (score: number) => {
    const token = localStorage.getItem("token")
    if (!token || !selectedNode) return

    try {
      const res = await fetch(`/api/nodes/${selectedNode.id}/submit-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ score })
      })

      if (res.ok) {
        setIsPlayingGame(false)
        setSelectedNode(null)
        // Refresh all data
        fetchData()
      } else {
        alert("Erro ao registrar pontuação")
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Complete reading material
  const handleCompleteMaterial = async () => {
    const token = localStorage.getItem("token")
    if (!token || !selectedNode) return

    try {
      const res = await fetch(`/api/nodes/${selectedNode.id}/complete`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      })

      if (res.ok) {
        setIsReadingMaterial(false)
        setSelectedNode(null)
        // Refresh all data
        fetchData()
      } else {
        alert("Erro ao salvar progresso")
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  // Group nodes by axis/eixo
  const salesNodes = nodes.filter(n => n.eixo === "vendas")
  const connectionsNodes = nodes.filter(n => n.eixo === "conexoes")
  const cxNodes = nodes.filter(n => n.eixo === "experiencia")

  // Find material details matching reference_id
  const activeMaterial = selectedNode && selectedNode.type === "material"
    ? contents.find(c => c.id === selectedNode.reference_id)
    : null

  // Filter contents list search
  const filteredContents = contents.filter((content) =>
    content.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isUserAxis = (axisName: string) => {
    if (!user?.eixo) return false
    const parsedEixo = user.eixo.toLowerCase()
    if (axisName === "vendas" && parsedEixo.includes("venda")) return true
    if (axisName === "conexoes" && parsedEixo.includes("conex")) return true
    if (axisName === "experiencia" && (parsedEixo.includes("experi") || parsedEixo.includes("xp"))) return true
    return false
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Compass className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Portal do Membro</h1>
                <p className="text-sm text-muted-foreground">Trilhas & Aprendizado</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">{user.name}</span>
                  {user.eixo && (
                    <Badge variant="secondary" className="text-xs bg-primary/10 border-primary/20 text-primary uppercase font-bold">
                      {user.eixo}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs font-semibold">
                    🏆 {user.pontos_acumulados} pts
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

      {/* Main Container */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="trilhas" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Compass className="h-4 w-4" />
              Trilhas de Desenvolvimento
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Trophy className="h-4 w-4" />
              Leaderboard Cumulativo
            </TabsTrigger>
            <TabsTrigger value="biblioteca" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-4 w-4" />
              Biblioteca
            </TabsTrigger>
          </TabsList>

          {/* TAB: Trilhas */}
          <TabsContent value="trilhas" className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Suas Trilhas de Aprendizado</h2>
              <p className="text-muted-foreground">
                Selecione um nó disponível para ler conteúdos ou jogar simuladores. Sua trilha oficial está sinalizada com destaque.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Vendas */}
              <TrainingPath
                nodes={salesNodes}
                onSelectNode={handleSelectNode}
                highlighted={isUserAxis("vendas")}
                axisName="Vendas"
              />

              {/* Conexões */}
              <TrainingPath
                nodes={connectionsNodes}
                onSelectNode={handleSelectNode}
                highlighted={isUserAxis("conexoes")}
                axisName="Conexões"
              />

              {/* Experiência */}
              <TrainingPath
                nodes={cxNodes}
                onSelectNode={handleSelectNode}
                highlighted={isUserAxis("experiencia")}
                axisName="Experiência do Consumidor"
              />
            </div>
          </TabsContent>

          {/* TAB: Leaderboard */}
          <TabsContent value="ranking" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <Trophy className="text-yellow-500 w-7 h-7" /> Ranking Geral de Comercial
              </h2>
              <p className="text-muted-foreground">
                Classificação cumulativa dos membros e trainees baseada no progresso das trilhas e nos jogos.
              </p>
            </div>

            <Card className="border-border bg-card">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {leaderboard.map((entry, index) => {
                    const isCurrentUser = entry.id === user?.id
                    const isTopThree = index < 3
                    const medals = ["🥇", "🥈", "🥉"]

                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center justify-between p-4 transition-all ${
                          isCurrentUser ? "bg-primary/5 border-l-4 border-l-primary" : ""
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`w-8 text-center font-bold text-sm ${isTopThree ? "text-lg" : "text-muted-foreground"}`}>
                            {isTopThree ? medals[index] : index + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-sm ${isCurrentUser ? "text-primary" : "text-foreground"}`}>
                                {entry.name}
                              </span>
                              {entry.type === "trainee" && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  Trainee
                                </Badge>
                              )}
                              {entry.eixo && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/20 text-primary">
                                  {entry.eixo}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{entry.cargo}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 font-black text-foreground">
                          <Award className="w-4 h-4 text-primary" />
                          <span>{entry.pontos_acumulados} pts</span>
                        </div>
                      </div>
                    )
                  })}

                  {leaderboard.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      Nenhum dado de ranking cadastrado.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Biblioteca */}
          <TabsContent value="biblioteca" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-foreground">Pesquisa Rápida</h2>
                <p className="text-xs text-muted-foreground">Busque por materiais arquivados</p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="grid gap-4">
              {filteredContents.map((content) => (
                <ViewContentCard key={content.id} content={content} />
              ))}

              {filteredContents.length === 0 && (
                <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                  Nenhum material encontrado.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* MODAL: Leitor de Material */}
      <Dialog open={isReadingMaterial} onOpenChange={setIsReadingMaterial}>
        <DialogContent className="max-w-2xl bg-card border-border text-foreground">
          {activeMaterial ? (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest text-[9px] font-extrabold">
                    {activeMaterial.eixo}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-extrabold mt-2 leading-tight">
                  {activeMaterial.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Texto */}
                {activeMaterial.text && (
                  <div className="prose prose-sm dark:prose-invert max-w-none bg-muted p-5 rounded-xl border border-border leading-relaxed text-sm text-foreground whitespace-pre-line font-medium">
                    {activeMaterial.text}
                  </div>
                )}

                {/* Vídeos e Links */}
                {((activeMaterial.videos && activeMaterial.videos.length > 0) ||
                  (activeMaterial.documents && activeMaterial.documents.length > 0)) && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Recursos Adicionais</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Vídeos */}
                      {activeMaterial.videos?.map((vidUrl, i) => (
                        <a
                          key={i}
                          href={vidUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-secondary rounded-xl hover:bg-secondary/80 border border-border text-xs font-semibold transition"
                        >
                          <div className="bg-rose-500/10 text-rose-500 p-2 rounded-lg">
                            <Video className="w-4 h-4" />
                          </div>
                          <span className="flex-1 truncate">Vídeo de Apoio {i + 1}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                      ))}

                      {/* Documentos */}
                      {activeMaterial.documents?.map((doc, i) => (
                        <a
                          key={i}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-secondary rounded-xl hover:bg-secondary/80 border border-border text-xs font-semibold transition"
                        >
                          <div className="bg-primary/10 text-primary p-2 rounded-lg">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="flex-1 truncate">{doc.name}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="flex justify-end pt-4 border-t border-border gap-3">
                  <Button variant="outline" onClick={() => setIsReadingMaterial(false)}>
                    Fechar Leitor
                  </Button>
                  <Button onClick={handleCompleteMaterial} disabled={selectedNode?.completed}>
                    {selectedNode?.completed ? "Já Concluído" : "Marcar como Concluído (+50 pts)"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Carregando conteúdo...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Jogar Game */}
      <Dialog open={isPlayingGame} onOpenChange={setIsPlayingGame}>
        <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden">
          {selectedNode && isPlayingGame && (
            <div className="p-6">
              <SpinGame
                nodeName={selectedNode.name}
                questions={selectedNode.questions}
                onComplete={handleGameComplete}
                onClose={() => {
                  setIsPlayingGame(false)
                  setSelectedNode(null)
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}

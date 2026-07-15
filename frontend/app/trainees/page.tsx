"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { type ContentItem } from "@/lib/content-data"
import { ViewContentCard } from "@/components/content/view-content-card"
import { TrainingPath } from "@/components/dashboard/training-path"
import { SpinGame } from "@/components/games/spin-game"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import {
  Compass,
  LogOut,
  User,
  Trophy,
  GraduationCap,
  FileText,
  Video,
  ExternalLink,
  Award,
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

export default function TraineesPage() {
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()

  // Data states
  const [contents, setContents] = useState<ContentItem[]>([])
  const [nodes, setNodes] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // UI states
  const [activeTab, setActiveTab] = useState("trilha")
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
      console.error("Erro ao carregar dados do trainee:", e)
    }
  }

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login")
      } else if (user.type === "admin") {
        router.push("/")
      } else if (user.type === "membro") {
        router.push("/membros")
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
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ score })
      })

      if (res.ok) {
        setIsPlayingGame(false)
        setSelectedNode(null)
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

  // Find material details matching reference_id
  const activeMaterial = selectedNode && selectedNode.type === "material"
    ? contents.find(c => c.id === selectedNode.reference_id)
    : null

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Portal do Trainee</h1>
                <p className="text-sm text-muted-foreground">Capacitação &amp; Resultados</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">{user.name}</span>
                  <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                    Trainee
                  </Badge>
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
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Info Box */}
        <div className="bg-gradient-to-r from-card to-secondary/30 border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <GraduationCap className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground mb-0.5">
                  Olá, {user?.name}!
                </h2>
                <p className="text-xs text-muted-foreground">
                  Acompanhe sua capacitação comercial na trilha estilo Duolingo e compita no ranking cumulativo.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 self-stretch sm:self-auto bg-card p-3 rounded-xl border border-border justify-around sm:justify-start">
              <div className="text-center px-4 border-r border-border">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pontos Totais</span>
                <p className="text-lg font-black text-primary mt-0.5">{user?.pontos_acumulados} pts</p>
              </div>
              <div className="text-center px-4">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Nota de Rotação</span>
                <p className="text-lg font-black text-amber-500 mt-0.5">
                  {user?.nota_rotacao !== null && user?.nota_rotacao !== undefined ? user?.nota_rotacao.toFixed(1) : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="trilha" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Compass className="h-4 w-4" />
              Trilha de Capacitação
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Trophy className="h-4 w-4" />
              Leaderboard Cumulativo
            </TabsTrigger>
          </TabsList>

          {/* TAB: Trilha */}
          <TabsContent value="trilha" className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Sua Jornada de Capacitação</h2>
              <p className="text-xs text-muted-foreground">
                Conclua cada etapa para desbloquear a próxima. Nós com cadeado estão bloqueados ou aguardando liberação pelo admin.
              </p>
            </div>

            <div className="flex justify-center py-6 bg-card rounded-2xl border border-border">
              <TrainingPath
                nodes={nodes}
                onSelectNode={handleSelectNode}
                highlighted={true}
              />
            </div>
          </TabsContent>

          {/* TAB: Leaderboard */}
          <TabsContent value="ranking" className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Trophy className="text-yellow-500 w-5 h-5" /> Ranking Geral de Vendas
              </h2>
              <p className="text-xs text-muted-foreground">
                Classificação cumulativa de todos os trainees e membros. Veja sua posição e corra atrás do topo!
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
                    Capacitação Geral
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

                {/* Recursos Adicionais */}
                {((activeMaterial.videos && activeMaterial.videos.length > 0) ||
                  (activeMaterial.documents && activeMaterial.documents.length > 0)) && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Recursos Adicionais</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

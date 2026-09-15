"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { type ContentItem } from "@/lib/content-data"
import { ViewContentCard } from "@/components/content/view-content-card"
import { TrainingPath } from "@/components/dashboard/training-path"
import { LibraryGame } from "@/components/games/library-game"
import { SpinGame } from "@/components/games/spin-game"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  LayoutGrid, Search, LogOut, User, BookOpen, Trophy, Compass,
  FileText, Video, ExternalLink, Award, ClipboardList, Upload, Clock, Link2
} from "lucide-react"

import { ActivitySubmissionForm } from "@/components/activities/submission-form"
import { SubmissionContent } from "@/components/activities/submission-content"

import { useNodes, useNodeContent } from "@/features/nodes/hooks"
import type { GameAnswer, GameResult } from "@/features/nodes/types"
import { useActivities } from "@/features/activities/hooks"
import { useMaterials } from "@/features/materials/hooks"

interface LeaderboardEntry {
  id: string; name: string; email: string; cargo: string; type: string; eixo?: string; pontos_acumulados: number
}

export default function MembrosPage() {
  const router = useRouter()
  const { user, logout, isLoading, refreshUser } = useAuth()

  const { materials, refresh: refreshMaterials } = useMaterials()
  const contents: ContentItem[] = materials as unknown as ContentItem[]
  const { nodes, completeNode, submitGame, refresh: refreshNodes } = useNodes()
  const { activities, refresh: refreshActivities } = useActivities()

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [activeTab, setActiveTab] = useState("trilhas")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [isPlayingGame, setIsPlayingGame] = useState(false)
  const [isReadingMaterial, setIsReadingMaterial] = useState(false)
  const { content: nodeContent, loading: contentLoading, error: contentError, refresh: refreshNodeContent } = useNodeContent(
    isReadingMaterial ? selectedNode?.id ?? null : null
  )
  const [selectedEixo, setSelectedEixo] = useState<string>("todos")

  const fetchLeaderboard = async () => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch("/api/leaderboard", { headers: { "Authorization": `Bearer ${token}` } })
      if (res.ok) setLeaderboard(await res.json())
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.push("/login")
      else if (user.type === "trainee") router.push("/trainees")
      else if (user.type === "admin" || user.type === "organizador") router.push("/")
      else fetchLeaderboard()
    }
  }, [user, isLoading, router])

  const refreshProgress = async () => {
    // The submission is already saved; a refresh failure must not be reported as a failed submission.
    const results = await Promise.allSettled([refreshUser(), fetchLeaderboard(), refreshNodes(), refreshMaterials(), refreshActivities()])
    results.forEach(result => {
      if (result.status === "rejected") console.error("Erro ao atualizar progresso:", result.reason)
    })
  }

  const handleLogout = () => { logout(); router.push("/login") }

  const handleSelectNode = (node: any) => {
    setSelectedNode(node)
    if (node.type === "game") setIsPlayingGame(true)
    else {
      setIsReadingMaterial(true)
    }
  }

  const handleGameComplete = async (answers: GameAnswer[]): Promise<GameResult> => {
    if (!selectedNode) throw new Error("Selecione um jogo na trilha para continuar.")
    const result = await submitGame(selectedNode.id, answers)
    await refreshProgress()
    return result
  }

  const handleCompleteMaterial = async () => {
    if (!selectedNode) return
    try {
      await completeNode(selectedNode.id)
      await refreshProgress()
      setIsReadingMaterial(false)
      setSelectedNode(null)
    } catch { alert("Erro ao salvar progresso") }
  }

  if (isLoading || !user || user.type !== "membro") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  const salesNodes = nodes.filter(n => n.eixo === "vendas")
  const connectionsNodes = nodes.filter(n => n.eixo === "conexoes")
  const cxNodes = nodes.filter(n => n.eixo === "experiencia")

  const relatedActivity = nodeContent?.activity
  const activeMaterial = nodeContent?.material

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
                nodes={salesNodes as any[]}
                onSelectNode={handleSelectNode}
                highlighted={isUserAxis("vendas")}
                axisName="Vendas"
              />

              {/* Conexões */}
              <TrainingPath
                nodes={connectionsNodes as any[]}
                onSelectNode={handleSelectNode}
                highlighted={isUserAxis("conexoes")}
                axisName="Conexões"
              />

              {/* Experiência */}
              <TrainingPath
                nodes={cxNodes as any[]}
                onSelectNode={handleSelectNode}
                highlighted={isUserAxis("experiencia")}
                axisName="Experiência do Consumidor"
              />
            </div>
          </TabsContent>



          {/* TAB: Biblioteca */}
          <TabsContent value="biblioteca" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-foreground">Biblioteca de Materiais</h2>
                <p className="text-xs text-muted-foreground">Filtre materiais por eixo de conhecimento ou pesquise pelo nome.</p>
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

            {/* Eixo Filter Buttons */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
              {[
                { id: "todos", name: "Todos" },
                { id: "trainee", name: "Trainee (Geral)" },
                { id: "vendas", name: "Vendas" },
                { id: "conexoes", name: "Conexões" },
                { id: "experiencia", name: "Experiência" }
              ].map((e) => (
                <Button
                  key={e.id}
                  variant={selectedEixo === e.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedEixo(e.id)}
                  className={`text-xs h-8 rounded-lg ${
                    selectedEixo === e.id
                      ? "bg-primary text-primary-foreground hover:bg-primary/95"
                      : "hover:bg-secondary/80 border-border"
                  }`}
                >
                  {e.name}
                </Button>
              ))}
            </div>

            <div className="grid gap-4">
              {(() => {
                const filteredByEixo = selectedEixo === "todos"
                  ? contents
                  : contents.filter(c => c.eixo === selectedEixo)
                const finalFiltered = filteredByEixo.filter(c =>
                  c.name.toLowerCase().includes(searchQuery.toLowerCase())
                )

                if (finalFiltered.length === 0) {
                  return (
                    <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                      Nenhum material encontrado neste filtro.
                    </div>
                  )
                }

                return finalFiltered.map((content) => (
                  <ViewContentCard key={content.id} content={content} />
                ))
              })()}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* MODAL: Leitor de Material */}
      <Dialog open={isReadingMaterial} onOpenChange={setIsReadingMaterial}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold mt-2 leading-tight">
              {activeMaterial?.name || selectedNode?.name || "Material de Capacitação"}
            </DialogTitle>
            <DialogDescription className="sr-only">Conteúdo e atividades da etapa selecionada na trilha.</DialogDescription>
          </DialogHeader>
          {contentLoading || (!nodeContent && !contentError) ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">Carregando conteúdo...</p>
          ) : contentError ? (
            <div className="space-y-4 py-8 text-center">
              <p role="alert" className="text-sm text-destructive">{contentError}</p>
              <Button variant="outline" onClick={() => void refreshNodeContent()}>Tentar novamente</Button>
            </div>
          ) : activeMaterial || relatedActivity ? (
            <>
              <div className="flex items-center justify-between">
                <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest text-[9px] font-extrabold">
                  {activeMaterial?.eixo || relatedActivity?.eixo}
                </Badge>
              </div>

              <div className="space-y-6 mt-4">
                {/* Texto */}
                {activeMaterial?.text && (
                  <div className="prose prose-sm dark:prose-invert max-w-none bg-muted p-5 rounded-xl border border-border leading-relaxed text-sm text-foreground whitespace-pre-line font-medium">
                    {activeMaterial?.text}
                  </div>
                )}

                {/* Vídeos e Links */}
                {((activeMaterial?.videos && activeMaterial?.videos.length > 0) ||
                  (activeMaterial?.documents && activeMaterial?.documents.length > 0)) && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Recursos Adicionais</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Vídeos */}
                      {activeMaterial?.videos?.map((vidUrl, i) => (
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
                      {activeMaterial?.documents?.map((doc, i) => (
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

                {/* Related Activity Section */}
                {relatedActivity && (
                  <div className="mt-6 border-t border-border pt-4 space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-primary" /> Atividade Requerida: {relatedActivity.title}
                    </h4>
                    {relatedActivity.description && (
                      <p className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-border">
                        {relatedActivity.description}
                      </p>
                    )}
                    {(selectedNode?.deadline || relatedActivity.deadline) && (
                      <p className="text-[10px] text-amber-400 flex items-center gap-1 font-semibold">
                        <Clock className="w-3.5 h-3.5" /> Prazo de entrega: {new Date(selectedNode?.deadline || relatedActivity.deadline).toLocaleString("pt-BR")}
                      </p>
                    )}

                    {/* Submission status or form */}
                    {relatedActivity.my_submission ? (
                      <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-2">
                        <p className="text-xs font-semibold text-emerald-400">✓ Atividade Enviada</p>
                        <SubmissionContent submission={relatedActivity.my_submission} />
                        {relatedActivity.my_submission.grade !== null && relatedActivity.my_submission.grade !== undefined && (
                          <div className="pt-2 border-t border-emerald-500/20">
                            <p className="text-xs font-bold text-emerald-400">Nota: {relatedActivity.my_submission.grade.toFixed(1)}</p>
                            {relatedActivity.my_submission.feedback && (
                              <p className="text-xs text-muted-foreground">{relatedActivity.my_submission.feedback}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* If open and not submitted, show the inputs */}
                    {relatedActivity.effective_open && !relatedActivity.my_submission && (
                      <ActivitySubmissionForm activity={relatedActivity} nodeId={selectedNode.id}
                        onSubmitted={async () => {
                          await refreshActivities()
                          await refreshProgress()
                          setIsReadingMaterial(false)
                          setSelectedNode(null)
                        }} />
                    )}
                  </div>
                )}

                {/* Ações */}
                <div className="flex justify-end pt-4 border-t border-border gap-3">
                  <Button variant="outline" onClick={() => setIsReadingMaterial(false)}>
                    Fechar Leitor
                  </Button>
                  {selectedNode?.type === "material" && (!relatedActivity || relatedActivity.my_submission) && (
                    <Button onClick={handleCompleteMaterial} disabled={nodeContent?.node.completed}>
                      {nodeContent?.node.completed ? "Já concluído" : "Concluir etapa"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4 py-8 text-center text-sm text-muted-foreground">
              <p role="status">{!selectedNode?.reference_id && !selectedNode?.activity_id
                ? "Esta etapa está sem conteúdo vinculado. Avise o responsável pela trilha para associar o material ou a atividade."
                : "O conteúdo desta etapa não está disponível. Ele pode ter sido removido ou ter o acesso alterado."}</p>
              <Button variant="outline" onClick={() => void refreshNodeContent()}>Tentar novamente</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Jogar Game */}
      <Dialog open={isPlayingGame} onOpenChange={setIsPlayingGame}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedNode?.name || "Questionário"}</DialogTitle>
            <DialogDescription>Jogo da etapa selecionada na trilha.</DialogDescription>
          </DialogHeader>
          {selectedNode && isPlayingGame && (
            <div className="p-6">
              {selectedNode.game_revision_id ? (
                <LibraryGame nodeId={selectedNode.id}
                  onCompleted={async () => { await refreshProgress(); setIsPlayingGame(false); setSelectedNode(null) }}
                  onClose={() => { setIsPlayingGame(false); setSelectedNode(null) }} />
              ) : (
              <SpinGame
                nodeName={selectedNode.name}
                questions={selectedNode.questions}
                onComplete={handleGameComplete}
                onClose={() => {
                  setIsPlayingGame(false)
                  setSelectedNode(null)
                }}
              />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { openAuthenticatedFile } from "@/lib/api-client"
import { LinkedText, safeHref } from "@/components/content/linked-text"
import { isStaff } from "@/lib/roles"
import { type ContentItem } from "@/lib/content-data"
import { ViewContentCard } from "@/components/content/view-content-card"
import { TrainingPath } from "@/components/dashboard/training-path"
import { LibraryGame } from "@/components/games/library-game"
import { SpinGame } from "@/components/games/spin-game"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Compass, LogOut, User, Trophy, GraduationCap, FileText, Video,
  ExternalLink, Award, ClipboardList, Upload, Clock, CheckCircle2,
  XCircle, Link2, BookOpen, Search,
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

export default function TraineesPage() {
  const router = useRouter()
  const { user, logout, isLoading, refreshUser } = useAuth()

  const { materials, refresh: refreshMaterials } = useMaterials()
  const contents: ContentItem[] = materials as unknown as ContentItem[]
  const { nodes, completeNode, submitGame, refresh: refreshNodes } = useNodes()
  const { activities, refresh: refreshActivities } = useActivities()

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [activeTab, setActiveTab] = useState("trilha")
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [isPlayingGame, setIsPlayingGame] = useState(false)
  const [isReadingMaterial, setIsReadingMaterial] = useState(false)
  const { content: nodeContent, loading: contentLoading, error: contentError, refresh: refreshNodeContent } = useNodeContent(
    isReadingMaterial ? selectedNode?.id ?? null : null
  )
  const [searchQuery, setSearchQuery] = useState("")

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
      else if (isStaff(user.type)) router.push("/")
      else if (user.type === "membro") router.push("/membros")
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

  if (isLoading || !user || user.type !== "trainee") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  const relatedActivity = nodeContent?.activity
  const activeMaterial = nodeContent?.material

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
                <p className="text-sm text-muted-foreground">Capacitação</p>
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
                  Avance pelos módulos da trilha comercial e complete as atividades propostas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 self-stretch sm:self-auto bg-card p-3 rounded-xl border border-border justify-around sm:justify-start">
              <div className="text-center px-4">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pontos Totais</span>
                <p className="text-lg font-black text-primary mt-0.5">{user?.pontos_acumulados ?? 0} pts</p>
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
            <TabsTrigger value="atividades" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ClipboardList className="h-4 w-4" />
              Atividades
              {activities.filter(a => a.effective_open && !a.my_submission).length > 0 && (
                <Badge className="ml-1 bg-amber-500 text-white text-[9px] px-1.5 py-0 h-4">
                  {activities.filter(a => a.effective_open && !a.my_submission).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="biblioteca" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-4 w-4" />
              Biblioteca
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
                nodes={nodes as any[]}
                onSelectNode={handleSelectNode}
                highlighted={true}
              />
            </div>
          </TabsContent>

          {/* TAB: Atividades */}
          <TabsContent value="atividades" className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Atividades</h2>
              <p className="text-xs text-muted-foreground">
                Envie seus anexos e, abaixo, adicione links e comentários. Algumas atividades exigem pelo menos um anexo.
              </p>
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma atividade disponível no momento.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const isOpen = activity.effective_open
                  const submitted = !!activity.my_submission

                  return (
                    <Card key={activity.id} className={`border-border bg-card ${
                      submitted ? "border-emerald-500/30" : isOpen ? "" : "opacity-60"
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base font-bold text-foreground">{activity.title}</CardTitle>
                            {activity.description && (
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{activity.description}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 items-end shrink-0">
                            {isOpen ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                                <CheckCircle2 className="h-3 w-3 mr-1" />Aberta
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-rose-400 border-rose-500/30 text-[10px]">
                                <XCircle className="h-3 w-3 mr-1" />Encerrada
                              </Badge>
                            )}
                            {activity.accepts_file && (
                              <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">
                                <Upload className="h-3 w-3 mr-1" />Envio obrigatório
                              </Badge>
                            )}
                          </div>
                        </div>
                        {activity.deadline && (
                          <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            Prazo: {new Date(activity.deadline).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {submitted && activity.my_submission && (
                          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1">
                            <p className="text-xs font-semibold text-emerald-400">✓ Enviado</p>
                            <SubmissionContent submission={activity.my_submission} />
                            {activity.my_submission.grade !== null && activity.my_submission.grade !== undefined && (
                              <div className="pt-2 border-t border-emerald-500/20">
                                <p className="text-xs font-bold text-emerald-400">Nota: {activity.my_submission.grade.toFixed(1)}</p>
                                {activity.my_submission.feedback && (
                                  <p className="text-xs text-muted-foreground">{activity.my_submission.feedback}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {isOpen && (
                          <ActivitySubmissionForm activity={activity} onSubmitted={async () => {
                            await refreshActivities()
                            await refreshProgress()
                          }} />
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>



          {/* TAB: Biblioteca */}
          <TabsContent value="biblioteca" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-foreground">Biblioteca de Trainees</h2>
                <p className="text-xs text-muted-foreground">Consulte os materiais didáticos da sua capacitação.</p>
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
              {(() => {
                const traineeContents = contents.filter(c => c.eixo === "trainee")
                const filtered = traineeContents.filter((content) =>
                  content.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                      Nenhum material encontrado.
                    </div>
                  )
                }
                return filtered.map((content) => (
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
                  Capacitação Geral
                </Badge>
              </div>

              <div className="space-y-6 mt-4">
                {/* Texto */}
                {activeMaterial?.text && (
                  <div className="prose prose-sm dark:prose-invert max-w-none bg-muted p-5 rounded-xl border border-border leading-relaxed text-sm text-foreground whitespace-pre-line font-medium">
                    <LinkedText text={activeMaterial.text} />
                  </div>
                )}

                {/* Recursos Adicionais */}
                {((activeMaterial?.videos && activeMaterial?.videos.length > 0) ||
                  (activeMaterial?.documents && activeMaterial?.documents.length > 0)) && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Recursos Adicionais</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {activeMaterial?.videos?.filter(vidUrl => safeHref(vidUrl)).map((vidUrl, i) => (
                        <a
                          key={i}
                          href={safeHref(vidUrl)!}
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

                      {activeMaterial?.documents?.map((doc, i) => (
                        // Documentos enviados ficam em armazenamento privado: a abertura
                        // passa pelo download autenticado, que confere o acesso à etapa.
                        <button
                          key={i}
                          type="button"
                          onClick={() => void openAuthenticatedFile(doc.url).catch(error => alert(error instanceof Error ? error.message : "Não foi possível abrir o documento."))}
                          className="flex items-center gap-3 p-3 bg-secondary rounded-xl hover:bg-secondary/80 border border-border text-xs font-semibold transition text-left"
                        >
                          <div className="bg-primary/10 text-primary p-2 rounded-lg">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="flex-1 truncate">{doc.name}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
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

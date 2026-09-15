"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { gamesApi } from "@/features/games/api"
import { gameFormatLabels } from "@/features/games/drafts"
import type { Game } from "@/features/games/types"
import { apiClient } from "@/lib/api-client"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { UsersSection } from "@/components/dashboard/users-section"
import { MemberForm } from "@/components/dashboard/member-form"
import { ContentList } from "@/components/dashboard/content-list"
import { ContentItem } from "@/components/dashboard/content-card"
import { CorrectionsQueue } from "@/components/dashboard/corrections-queue"
import { CorrectionRow } from "@/components/dashboard/correction-row"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Users, FileQuestion, LogOut, User, Shield, Compass, Lock, Unlock,
  Calendar, BookOpen, Gamepad2, Clock, CheckCircle2, ClipboardCheck, ClipboardList,
  Plus, ChevronDown, ChevronUp, Trash2, ExternalLink, Link2, Upload,
  XCircle, Award, Calculator, Scale, Pencil,
} from "lucide-react"

import { useNodes, utcToLocalInput } from "@/features/nodes/hooks"
import { useActivities } from "@/features/activities/hooks"
import { useUsers } from "@/features/users/hooks"
import { useMaterials } from "@/features/materials/hooks"
import { NodeActivityLink } from "@/components/dashboard/node-activity-link"
import type { TrainingNode } from "@/features/nodes/types"

export default function Dashboard() {
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()

  // Feature hooks
  const { materials, createMaterial, updateMaterial, deleteMaterial } = useMaterials()
  const contents: ContentItem[] = materials as unknown as ContentItem[]

  const { members, trainees, grades, refresh: refreshUsers, createUser, updateUser, deleteUser, updateTrainee } = useUsers()

  const { nodes, nodeReleaseState, setNodeReleaseState, updateReleaseLocal, saveNodeRelease, moveNode, deleteNode, refresh: refreshNodes } = useNodes()

  const {
    activities, activitySubmissions, expandedActivity,
    createActivity, updateActivity, toggleActivity, deleteActivity, loadSubmissions, gradeSubmission, deleteSubmission,
  } = useActivities()

  // Edit activity state
  const [editActivityId, setEditActivityId] = useState<string | null>(null)
  const [editActivityForm, setEditActivityForm] = useState({
    title: "", description: "", eixo: "trainee", accepts_file: true, deadline: "", material_id: "", weight: 1,
  })

  // Local UI state
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [newActivityForm, setNewActivityForm] = useState({
    title: "", description: "", eixo: "trainee", accepts_file: true, deadline: "", material_id: "", weight: 1,
  })
  const [showNodeForm, setShowNodeForm] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [gameRevisionId, setGameRevisionId] = useState("")
  const [prerequisiteId, setPrerequisiteId] = useState("")
  const [nodeError, setNodeError] = useState("")
  const [creatingNode, setCreatingNode] = useState(false)
  useEffect(() => {
    if (!showNodeForm || !user || !["admin", "organizador"].includes(user.type)) return
    gamesApi.list().then(setGames).catch(error => setNodeError(error.message))
  }, [showNodeForm, user?.id])
  const [nodeForm, setNodeForm] = useState({
    name: "", type: "activity" as "activity" | "game", eixo: "trainee",
    activity_id: "", reference_id: "", deadline: "", is_released: false,
    questions: [] as Array<{ text: string; explanation: string; options: Array<{ text: string; is_correct: boolean; score: number; feedback: string }> }>,
  })

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.push("/login")
      else if (user.type !== "admin" && user.type !== "organizador") {
        router.push(user.type === "membro" ? "/membros" : "/trainees")
      }
    }
  }, [user, isLoading, router])

  const handleUpdateContent = async (updated: ContentItem) => {
    await updateMaterial(updated.id, {
      name: updated.name, type: updated.type, eixo: updated.eixo, text: updated.text || "",
      documents: (updated.documents || []).map((d: any) => ({ name: d.name, url: d.url })),
      videos: updated.videos || [],
    })
  }

  const handleAddContent = async (newContent: ContentItem) => {
    await createMaterial({
      name: newContent.name, type: newContent.type, eixo: newContent.eixo, text: newContent.text || "",
      documents: (newContent.documents || []).map((d: any) => ({ name: d.name, url: d.url })),
      videos: newContent.videos || [],
    })
  }

  const handleDeleteContent = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este material?")) return
    try { await deleteMaterial(id) } catch (e: any) { alert(e.message || "Erro ao excluir material") }
  }

  const handleAddMember = async (data: {
    name: string; email: string; cargo: "admin" | "organizador" | "membro" | "trainee";
    password?: string; eixo?: "vendas" | "conexoes" | "experiencia"
  }) => {
    let userType = "membro"
    if (data.cargo === "trainee") userType = "trainee"
    else if (data.cargo === "admin") userType = "admin"
    else if (data.cargo === "organizador") userType = "organizador"
    await createUser({ name: data.name, email: data.email, cargo: data.cargo, type: userType, eixo: data.eixo, password: data.password })
  }

  const handleUpdateTrainee = async (traineeId: string, data: { rotacao?: number }) => {
    try { await updateTrainee(traineeId, { rotacao: data.rotacao }) }
    catch (e: any) { alert(e.message || "Erro ao atualizar trainee") }
  }

  const handleUpdateUser = async (userId: string, data: any) => {
    try { await updateUser(userId, data) } catch (e: any) { alert(e.message || "Erro ao atualizar usuário") }
  }

  const handleDeleteUser = async (userId: string) => {
    try { await deleteUser(userId) } catch (e: any) { alert(e.message || "Erro ao excluir usuário") }
  }

  const handleCreateNode = async () => {
    if (creatingNode) return
    setCreatingNode(true)
    setNodeError("")
    let deadlineIso: string | null = null
    if (nodeForm.deadline) { const d = new Date(nodeForm.deadline); if (!isNaN(d.getTime())) deadlineIso = d.toISOString() }
    const payload: any = {
      name: nodeForm.name.trim() || null, type: nodeForm.type, eixo: nodeForm.eixo,
      activity_id: nodeForm.type === "activity" ? (nodeForm.activity_id || null) : null,
      reference_id: null,
      deadline: deadlineIso, is_released: nodeForm.is_released,
      game_revision_id: nodeForm.type === "game" ? gameRevisionId : null,
      prerequisite_node_id: prerequisiteId || null,
      questions: [],
    }
    try {
      await apiClient.post("/api/nodes", payload)
      await refreshNodes()
      setShowNodeForm(false)
      setGameRevisionId("")
      setPrerequisiteId("")
      setNodeForm({ name: "", type: "activity", eixo: "trainee", activity_id: "", reference_id: "", deadline: "", is_released: false, questions: [] })
    } catch (error) {
      setNodeError(error instanceof Error ? error.message : "Erro ao criar etapa")
    } finally {
      setCreatingNode(false)
    }
  }

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm("Tem certeza que deseja excluir este nó da trilha?")) return
    try { await deleteNode(nodeId) } catch (e: any) { alert(e.message || "Erro ao excluir nó") }
  }

  const handleSaveNodeRelease = async (nodeId: string) => {
    try { await saveNodeRelease(nodeId) } catch (e: any) { alert(e.message || "Erro ao atualizar liberação do nó") }
  }

  const handleMoveNode = async (nodeId: string, direction: "up" | "down", eixo: string) => {
    try { await moveNode(nodeId, direction, eixo) } catch (e: any) { console.error(e) }
  }

  const handleCreateActivity = async () => {
    try {
      await createActivity({
        title: newActivityForm.title, description: newActivityForm.description,
        eixo: newActivityForm.eixo, accepts_file: newActivityForm.accepts_file,
        deadline: newActivityForm.deadline ? new Date(newActivityForm.deadline).toISOString() : null,
        material_id: newActivityForm.material_id || null, weight: Number(newActivityForm.weight),
      })
      setNewActivityForm({ title: "", description: "", eixo: "trainee", accepts_file: true, deadline: "", material_id: "", weight: 1 })
      setShowActivityForm(false)
    } catch (e: any) { alert(e.message || "Erro ao criar atividade") }
  }

  const handleToggleActivity = async (activityId: string, currentOpen: boolean) => {
    try { await toggleActivity(activityId, currentOpen) } catch (e: any) { alert(e.message) }
  }

  const handleOpenEditActivity = (act: (typeof activities)[0]) => {
    setEditActivityId(act.id)
    setEditActivityForm({
      title: act.title,
      description: act.description || "",
      eixo: act.eixo,
      accepts_file: act.accepts_file,
      deadline: act.deadline ? new Date(act.deadline).toISOString().slice(0, 16) : "",
      material_id: act.material_id || "",
      weight: act.weight ?? 1,
    })
  }

  const handleSaveEditActivity = async () => {
    if (!editActivityId) return
    try {
      await updateActivity(editActivityId, {
        title: editActivityForm.title,
        description: editActivityForm.description,
        accepts_file: editActivityForm.accepts_file,
        deadline: editActivityForm.deadline ? new Date(editActivityForm.deadline).toISOString() : null,
        material_id: editActivityForm.material_id || null,
        weight: Number(editActivityForm.weight),
      })
      setEditActivityId(null)
      await refreshUsers()
    } catch (e: any) { alert(e.message || "Erro ao salvar atividade") }
  }

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta atividade?")) return
    try { await deleteActivity(activityId); await refreshUsers() } catch (e: any) { alert(e.message) }
  }

  const handleLoadSubmissions = async (activityId: string) => {
    try { await loadSubmissions(activityId) } catch (e: any) { console.error(e) }
  }


  const handleLogout = () => { logout(); router.push("/login") }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  const isOrg = user?.type === "organizador"

  function getNodeStatus(node: TrainingNode) {
    if (!node.is_released) return { label: "Bloqueado", color: "text-rose-400 border-rose-500/30", icon: Lock }
    if (node.released_at) {
      const releaseDate = new Date(node.released_at)
      if (releaseDate > new Date()) return { label: `Agendado`, color: "text-amber-400 border-amber-500/30", icon: Clock }
    }
    return { label: "Liberado", color: "text-emerald-400 border-emerald-500/30", icon: CheckCircle2 }
  }

  const nodesByEixo: Record<string, TrainingNode[]> = {}
  const filteredNodes = isOrg ? nodes.filter(n => n.eixo === "trainee") : nodes
  filteredNodes.forEach(n => { if (!nodesByEixo[n.eixo]) nodesByEixo[n.eixo] = []; nodesByEixo[n.eixo].push(n) })
  Object.keys(nodesByEixo).forEach(key => { nodesByEixo[key].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)) })

  const eixoLabel: Record<string, string> = {
    trainee: "Trainee (Geral)", vendas: "Vendas", conexoes: "Conexões",
    experiencia: "Experiência do Consumidor",
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {isOrg ? "Dashboard Organizador" : "Dashboard Admin"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isOrg ? "Gestão do PlugInfo" : "Gestão Comercial"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.name}</span>
                  <Badge variant="outline" className="text-primary border-primary/30">
                    {isOrg ? "PlugInfo" : "Admin"}
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
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="usuarios" className="space-y-8">
          <TabsList className="bg-card border border-border flex-wrap h-auto gap-1">
            <TabsTrigger value="usuarios" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="h-4 w-4" />
              {isOrg ? "Trainees" : "Usuários"}
            </TabsTrigger>
            <TabsTrigger value="materiais" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileQuestion className="h-4 w-4" />
              Materiais
            </TabsTrigger>
            <TabsTrigger value="atividades" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ClipboardList className="h-4 w-4" />
              Atividades
            </TabsTrigger>
            <TabsTrigger value="correcoes" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ClipboardCheck className="h-4 w-4" />
              Correções
            </TabsTrigger>
            <TabsTrigger value="notas" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Award className="h-4 w-4" />
              Notas
            </TabsTrigger>
            <TabsTrigger value="trilha" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Compass className="h-4 w-4" />
              Trilha
            </TabsTrigger>
          </TabsList>

          {/* Seção Usuários */}
          <TabsContent value="usuarios" className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                  {isOrg ? "Trainees do PlugInfo" : "Usuários"}
                </h2>
                <p className="text-muted-foreground">
                  {isOrg ? "Gerencie e acompanhe os trainees sob sua supervisão" : "Gerencie os membros e trainees do setor comercial"}
                </p>
              </div>
              <MemberForm onSubmit={handleAddMember} userType={user?.type} />
            </div>
            <UsersSection
              members={members}
              trainees={trainees}
              showGrades={true}
              showProfiles={true}
              currentUserRole={user?.type}
              onUpdateTrainee={handleUpdateTrainee}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          </TabsContent>

          {/* Seção Atividades */}
          <TabsContent value="atividades" className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-foreground">Atividades</h2>
                <p className="text-muted-foreground text-sm">
                  Crie atividades para os trainees/membros enviarem arquivos. Defina prazo e avalie as submissões.
                </p>
              </div>
              <Button size="sm" className="gap-2" onClick={() => setShowActivityForm(v => !v)}>
                <Plus className="h-4 w-4" />
                Nova Atividade
              </Button>
            </div>

            {showActivityForm && (
              <Card className="border-primary/30 bg-card">
                <CardContent className="pt-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Nova Atividade</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs text-muted-foreground">Título *</label>
                      <Input
                        placeholder="Ex: Relatório de Prospecção"
                        value={newActivityForm.title}
                        onChange={e => setNewActivityForm(p => ({ ...p, title: e.target.value }))}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs text-muted-foreground">Descrição</label>
                      <Input
                        placeholder="Instruções da atividade..."
                        value={newActivityForm.description}
                        onChange={e => setNewActivityForm(p => ({ ...p, description: e.target.value }))}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Eixo / Público</label>
                      <select
                        value={newActivityForm.eixo}
                        onChange={e => setNewActivityForm(p => ({ ...p, eixo: e.target.value }))}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground"
                      >
                        <option value="trainee">Trainees</option>
                        {!isOrg && (
                          <>
                            <option value="vendas">Membros — Vendas</option>
                            <option value="conexoes">Membros — Conexões</option>
                            <option value="experiencia">Membros — Experiência</option>
                            <option value="all">Todos</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="activity-material" className="text-xs text-muted-foreground">Material da atividade (opcional)</label>
                      <select
                        id="activity-material"
                        value={newActivityForm.material_id}
                        onChange={e => setNewActivityForm(p => ({ ...p, material_id: e.target.value }))}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground"
                      >
                        <option value="">Nenhum</option>
                        {contents
                          .filter(c => {
                            if (newActivityForm.eixo === "all") return true;
                            if (newActivityForm.eixo === "trainee") return c.type === "trainee";
                            return c.eixo === newActivityForm.eixo;
                          })
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))
                        }
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Scale className="h-3 w-3" /> Peso (Média Ponderada)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={newActivityForm.weight}
                        onChange={e => setNewActivityForm(p => ({ ...p, weight: Number(e.target.value) }))}
                        className="bg-secondary border-border text-xs h-9"
                      />
                      <p className="text-xs text-muted-foreground">Peso 0: não vale nota na média. Peso maior: maior participação na média.</p>
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="accepts_file_check"
                        checked={newActivityForm.accepts_file}
                        onChange={e => setNewActivityForm(p => ({ ...p, accepts_file: e.target.checked }))}
                        className="rounded"
                      />
                      <label htmlFor="accepts_file_check" className="text-xs text-muted-foreground cursor-pointer">
                        Exige pelo menos um anexo
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" size="sm" onClick={() => setShowActivityForm(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleCreateActivity} disabled={!newActivityForm.title}>
                      Criar Atividade
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activities.length === 0 && (
              <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma atividade criada ainda.</p>
              </div>
            )}

            <div className="space-y-4">
              {activities.map((act) => {
                const isOpen = act.effective_open
                const isExpanded = expandedActivity === act.id
                const subs = activitySubmissions[act.id] || []

                return (
                  <Card key={act.id} className="border-border bg-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            {act.title}
                            {isOpen ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px]">Aberta</Badge>
                            ) : (
                              <Badge variant="outline" className="text-rose-400 border-rose-500/30 text-[9px]">Fechada</Badge>
                            )}
                            {act.accepts_file && (
                              <Badge variant="outline" className="text-primary border-primary/30 text-[9px]">
                                <Upload className="h-2.5 w-2.5 mr-0.5" />Arquivo
                              </Badge>
                            )}

                          </CardTitle>
                          {act.description && (
                            <p className="text-xs text-muted-foreground mt-1">{act.description}</p>
                          )}
                          {act.deadline && (
                            <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              Prazo: {new Date(act.deadline).toLocaleString("pt-BR")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2"
                            onClick={() => handleOpenEditActivity(act)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2"
                            onClick={() => handleToggleActivity(act.id, act.is_open)}
                          >
                            {act.is_open ? <><XCircle className="h-3 w-3 mr-1 text-rose-400" />Fechar</> : <><CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" />Abrir</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2"
                            onClick={() => handleLoadSubmissions(act.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            <span className="ml-1">{act.submission_count} envio{act.submission_count !== 1 ? 's' : ''}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-400 hover:text-rose-300 h-7 w-7 p-0"
                            onClick={() => handleDeleteActivity(act.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Edit Activity Inline Form */}
                    {editActivityId === act.id && (
                      <CardContent className="pt-0">
                        <div className="border-t border-primary/30 pt-4 space-y-3">
                          <h4 className="text-xs font-bold text-primary">Editar Atividade</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1 sm:col-span-2">
                              <label className="text-xs text-muted-foreground">Título *</label>
                              <Input
                                value={editActivityForm.title}
                                onChange={e => setEditActivityForm(p => ({ ...p, title: e.target.value }))}
                                className="bg-secondary border-border text-xs h-8"
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <label className="text-xs text-muted-foreground">Descrição</label>
                              <Input
                                value={editActivityForm.description}
                                onChange={e => setEditActivityForm(p => ({ ...p, description: e.target.value }))}
                                className="bg-secondary border-border text-xs h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground flex items-center gap-1"><Scale className="h-3 w-3" /> Peso</label>
                              <Input
                                type="number" min="0" step="0.5"
                                value={editActivityForm.weight}
                                onChange={e => setEditActivityForm(p => ({ ...p, weight: Number(e.target.value) }))}
                                className="bg-secondary border-border text-xs h-8"
                              />
                      <p className="text-xs text-muted-foreground">Peso 0: não vale nota na média. Peso maior: maior participação na média.</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Material Relacionado</label>
                              <select
                                value={editActivityForm.material_id}
                                onChange={e => setEditActivityForm(p => ({ ...p, material_id: e.target.value }))}
                                className="w-full h-8 rounded-md border border-border bg-secondary px-3 text-xs text-foreground"
                              >
                                <option value="">Nenhum</option>
                                {contents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <label className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Prazo</label>
                              <Input
                                type="datetime-local"
                                value={editActivityForm.deadline}
                                onChange={e => setEditActivityForm(p => ({ ...p, deadline: e.target.value }))}
                                className="bg-secondary border-border text-xs h-8"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editActivityForm.accepts_file}
                                onChange={e => setEditActivityForm(p => ({ ...p, accepts_file: e.target.checked }))}
                                className="rounded"
                              />
                              <label className="text-xs text-muted-foreground cursor-pointer">Exige pelo menos um anexo</label>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <Button variant="outline" size="sm" onClick={() => setEditActivityId(null)}>Cancelar</Button>
                            <Button size="sm" onClick={handleSaveEditActivity} disabled={!editActivityForm.title}>Salvar</Button>
                          </div>
                        </div>
                      </CardContent>
                    )}

                    {isExpanded && (
                      <CardContent className="pt-0 space-y-3">
                        <div className="border-t border-border pt-3">
                          {subs.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma submissão ainda.</p>
                          ) : (
                            <div className="space-y-3">
                              {subs.map((sub: any) => (
                                <CorrectionRow key={sub.id} submission={sub}
                                  onGrade={async (grade, feedback) => {
                                    await gradeSubmission(act.id, sub.id, grade, feedback)
                                    await refreshUsers()
                                  }}
                                  onDelete={async () => {
                                    await deleteSubmission(act.id, sub.id)
                                    await refreshUsers()
                                  }} />
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Seção Correções — fila única de envios */}
          <TabsContent value="correcoes" className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Correções</h2>
              <p className="text-muted-foreground text-sm">
                Todos os envios em uma fila, pendentes primeiro. A nota entra na média ponderada da pessoa assim que você salva.
              </p>
            </div>
            <CorrectionsQueue activities={activities} isOrganizer={isOrg} onGraded={() => { void refreshUsers() }} />
          </TabsContent>

          {/* Seção Notas */}
          <TabsContent value="notas" className="space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Planilha de Notas</h2>
              <p className="text-muted-foreground text-sm">
                Visão consolidada de desempenho. Trainees divididos por rotação.
              </p>
            </div>

            {/* Trainees */}
            {[1, 2, null].map((rot) => {
              const filtered = grades.filter((g: any) => g.type === "trainee" && (rot === null ? !g.rotacao : g.rotacao === rot))
              if (filtered.length === 0) return null
              return (
                <div key={String(rot)} className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full inline-block ${rot === 1 ? "bg-sky-400" : rot === 2 ? "bg-violet-400" : "bg-muted-foreground"}`} />
                    Trainees — {rot ? `Rotação ${rot}` : "Sem Rotação"}
                  </h3>
                  <div className="rounded-xl border border-border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50">
                          <th className="text-left p-3 font-semibold text-muted-foreground">Nome</th>
                          <th className="text-center p-3 font-semibold text-muted-foreground">Trilha %</th>
                          <th className="text-center p-3 font-semibold text-muted-foreground">Atividades</th>
                          <th className="text-center p-3 font-semibold text-muted-foreground">Média Ponderada</th>
                          <th className="text-center p-3 font-semibold text-muted-foreground">Pontos</th>
                          <th className="p-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((row: any) => (
                          <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                            <td className="p-3 font-medium text-foreground">{row.name}</td>
                            <td className="p-3 text-center">
                              {row.nodes_total > 0
                                ? <span className={row.nodes_completed / row.nodes_total >= 0.8 ? "text-emerald-400 font-semibold" : "text-muted-foreground"}>
                                    {Math.round((row.nodes_completed / row.nodes_total) * 100)}%
                                  </span>
                                : <span className="text-muted-foreground/40">—</span>
                              }
                            </td>
                            <td className="p-3 text-center text-muted-foreground">
                              {row.activities_graded}/{row.activities_submitted}
                            </td>
                            <td className="p-3 text-center">
                              {row.nota_rotacao != null
                                ? <span className={`font-bold ${row.nota_rotacao >= 7 ? "text-emerald-400" : row.nota_rotacao >= 5 ? "text-amber-400" : "text-rose-400"}`}>
                                    {row.nota_rotacao.toFixed(2)}
                                  </span>
                                : <span className="text-muted-foreground/40">—</span>
                              }
                            </td>
                            <td className="p-3 text-center text-primary font-semibold">{row.pontos_acumulados}</td>
                            <td className="p-3 text-right">
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-primary" onClick={() => window.open(`/perfil/${row.id}`)}>
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}

            {/* Membros */}
            {!isOrg && (() => {
              const membrosGrades = grades.filter((g: any) => g.type === "membro")
              if (membrosGrades.length === 0) return null
              return (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">Membros de Comercial</h3>
                  <div className="rounded-xl border border-border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50">
                          <th className="text-left p-3 font-semibold text-muted-foreground">Nome</th>
                          <th className="text-left p-3 font-semibold text-muted-foreground">Eixo</th>
                          <th className="text-center p-3 font-semibold text-muted-foreground">Trilha %</th>
                          <th className="text-center p-3 font-semibold text-muted-foreground">Atividades</th>
                          <th className="text-center p-3 font-semibold text-muted-foreground">Média Ponderada</th>
                          <th className="text-center p-3 font-semibold text-muted-foreground">Pontos</th>
                          <th className="p-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {membrosGrades.map((row: any) => (
                          <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                            <td className="p-3 font-medium text-foreground">{row.name}</td>
                            <td className="p-3 text-muted-foreground capitalize">{row.eixo || "—"}</td>
                            <td className="p-3 text-center">
                              {row.nodes_total > 0
                                ? <span className={row.nodes_completed / row.nodes_total >= 0.8 ? "text-emerald-400 font-semibold" : "text-muted-foreground"}>
                                    {Math.round((row.nodes_completed / row.nodes_total) * 100)}%
                                  </span>
                                : <span className="text-muted-foreground/40">—</span>
                              }
                            </td>
                            <td className="p-3 text-center text-muted-foreground">{row.activities_graded}/{row.activities_submitted}</td>
                            <td className="p-3 text-center">
                              {row.nota_rotacao != null
                                ? <span className={`font-bold ${row.nota_rotacao >= 7 ? "text-emerald-400" : row.nota_rotacao >= 5 ? "text-amber-400" : "text-rose-400"}`}>{row.nota_rotacao.toFixed(2)}</span>
                                : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="p-3 text-center text-primary font-semibold">{row.pontos_acumulados}</td>
                            <td className="p-3 text-right">
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-primary" onClick={() => window.open(`/perfil/${row.id}`)}>
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
          </TabsContent>

          {/* Seção Materiais */}
          <TabsContent value="materiais" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Materiais</h2>
              <p className="text-muted-foreground">
                {isOrg ? "Gerencie os materiais específicos dos Trainees" : "Gerencie os materiais disponíveis para membros e trainees"}
              </p>
            </div>
             <ContentList
              contents={isOrg ? contents.filter(c => c.type === "trainee") : contents}
              onUpdateContent={handleUpdateContent}
              onAddContent={handleAddContent}
              onDeleteContent={handleDeleteContent}
              userType={user?.type}
            />
          </TabsContent>

          {/* Seção Trilha — Gerenciamento de liberação de nós */}
          <TabsContent value="trilha" className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-foreground">Gerenciamento da Trilha</h2>
                <p className="text-muted-foreground text-sm">Crie o material na biblioteca, vincule-o a uma atividade e selecione a atividade no nó.</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/jogos"><Gamepad2 className="h-4 w-4 mr-2" />Biblioteca de jogos</Link>
              </Button>
              <Button size="sm" className="gap-2" onClick={() => setShowNodeForm(v => !v)}>
                <Plus className="h-4 w-4" />Novo Nó
              </Button>
            </div>

            {showNodeForm && (
              <Card className="border-primary/30 bg-card">
                <CardContent className="pt-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Novo Nó de Trilha</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="node-type" className="text-xs text-muted-foreground">Tipo de Nó</label>
                      <select id="node-type" value={nodeForm.type}
                        onChange={e => setNodeForm(p => ({ ...p, type: e.target.value as any, questions: [] }))}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground">
                        <option value="activity">Atividade</option>
                        <option value="game">Jogo da biblioteca</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Eixo</label>
                      {isOrg ? (
                        <Input value="Trainee" disabled className="bg-secondary border-border text-xs h-9" />
                      ) : (
                        <select value={nodeForm.eixo}
                          onChange={e => {
                            setNodeForm(p => ({ ...p, eixo: e.target.value, activity_id: "", reference_id: "" }))
                            setGameRevisionId("")
                            setPrerequisiteId("")
                          }}
                          className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground">
                          <option value="trainee">Trainee</option>
                          <option value="vendas">Vendas</option>
                          <option value="conexoes">Conexões</option>
                          <option value="experiencia">Experiência</option>
                        </select>
                      )}
                    </div>

                    {nodeForm.type === "activity" && (
                      <div className="space-y-1 sm:col-span-2">
                        <label htmlFor="node-activity" className="text-xs text-muted-foreground font-medium">Atividade Associada *</label>
                        <select id="node-activity" value={nodeForm.activity_id}
                          onChange={e => {
                            const actId = e.target.value
                            const act = activities.find(a => a.id === actId)
                            setNodeForm(p => ({
                              ...p,
                              activity_id: actId,
                              name: p.name || (act ? act.title : "")
                            }))
                          }}
                          className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground">
                          <option value="">Selecione uma atividade...</option>
                          {activities
                            .filter(a => nodeForm.eixo === "all" || a.eixo === "all" || a.eixo === nodeForm.eixo)
                            .map(a => (
                              <option key={a.id} value={a.id}>{a.title} — {contents.find(c => c.id === a.material_id)?.name || "Sem material"}</option>
                            ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs text-muted-foreground">Nome do Nó (opcional)</label>
                      <Input placeholder="Se vazio, usa o título do conteúdo selecionado" value={nodeForm.name}
                        onChange={e => setNodeForm(p => ({ ...p, name: e.target.value }))}
                        className="bg-secondary border-border text-xs h-9" />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Prazo da Atividade neste Nó (opcional)
                      </label>
                      <Input type="datetime-local" value={nodeForm.deadline}
                        onChange={e => setNodeForm(p => ({ ...p, deadline: e.target.value }))}
                        className="bg-secondary border-border text-xs h-9" />
                    </div>

                    {nodeForm.type === "game" && (
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="node-game">Jogo publicado</Label>
                        <select id="node-game" value={gameRevisionId} onChange={e => setGameRevisionId(e.target.value)}
                          className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm">
                          <option value="">Selecione um jogo...</option>
                          {games.filter(game => game.published_revision && (game.eixo === nodeForm.eixo || game.eixo === "all")).map(game => (
                            <option key={game.id} value={game.published_revision!.id}>
                              {game.published_revision!.title} — {gameFormatLabels[game.format]} (v{game.published_revision!.version})
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">Publique o jogo na <Link href="/jogos" className="underline">biblioteca de jogos</Link> para adicioná-lo à trilha.</p>
                      </div>
                    )}
                    <div className="sm:col-span-2 space-y-2">
                      <Label htmlFor="node-prerequisite">Pré-requisito</Label>
                      <select id="node-prerequisite" value={prerequisiteId} onChange={e => setPrerequisiteId(e.target.value)}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm">
                        <option value="">Sem pré-requisito</option>
                        {nodes.filter(node => node.eixo === nodeForm.eixo).map(node => (
                          <option key={node.id} value={node.id}>{node.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <input type="checkbox" id="node_released" checked={nodeForm.is_released}
                        onChange={e => setNodeForm(p => ({...p, is_released: e.target.checked}))} className="rounded" />
                      <label htmlFor="node_released" className="text-xs text-muted-foreground cursor-pointer">Liberar imediatamente</label>
                    </div>
                  </div>
                  {nodeError && <p role="alert" className="text-sm text-destructive">{nodeError}</p>}
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" size="sm" disabled={creatingNode} onClick={() => setShowNodeForm(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleCreateNode} disabled={creatingNode || (
                      nodeForm.type === "activity" ? !nodeForm.activity_id
                        : !gameRevisionId
                    )}>{creatingNode ? "Criando..." : "Criar Nó"}</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {nodes.length === 0 && !showNodeForm ? (
              <div className="text-center py-16 text-muted-foreground">
                <Compass className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum nó de trilha cadastrado ainda. Clique em "Novo Nó" para começar.</p>
              </div>
            ) : nodes.length > 0 ? (
              <div className="space-y-8">
                {Object.entries(nodesByEixo).map(([eixo, eixoNodes]) => (
                  <div key={eixo} className="space-y-3">
                    <h3 className="text-base font-semibold text-foreground border-b border-border pb-2">
                      {eixoLabel[eixo] || eixo}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {eixoNodes.map((node) => {
                        const localState = nodeReleaseState[node.id] || {
                          isReleased: node.is_released,
                          scheduledDate: node.released_at
                            ? utcToLocalInput(node.released_at)
                            : ""
                        }
                        const { label, color, icon: StatusIcon } = getNodeStatus(node)
                        const isDirty = (() => {
                          if (localState.isReleased !== node.is_released) return true
                          // Both sides in local datetime-local format for accurate comparison
                          const localDate = localState.scheduledDate || ""
                          const serverDate = node.released_at ? utcToLocalInput(node.released_at) : ""
                          return localDate !== serverDate
                        })()

                        return (
                          <Card key={node.id} className="border-border bg-card">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`p-1.5 rounded-lg ${node.type === "game" ? "bg-violet-500/10" : "bg-primary/10"}`}>
                                    {node.type === "game"
                                      ? <Gamepad2 className="h-4 w-4 text-violet-400" />
                                      : <BookOpen className="h-4 w-4 text-primary" />
                                    }
                                  </div>
                                  <div>
                                    <CardTitle className="text-sm font-semibold text-foreground truncate">
                                      {node.name}
                                    </CardTitle>
                                    {node.deadline && (
                                      <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5 font-medium">
                                        <Clock className="h-3 w-3" /> Prazo: {new Date(node.deadline).toLocaleString("pt-BR")}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center shrink-0 ml-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleMoveNode(node.id, "up", node.eixo)}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleMoveNode(node.id, "down", node.eixo)}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <Badge variant="outline" className={`text-[10px] shrink-0 flex items-center gap-1 ${color}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {localState.isReleased
                                    ? (localState.scheduledDate && new Date(localState.scheduledDate) > new Date() ? "Agendado" : "Liberado")
                                    : "Bloqueado"}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {node.type !== "game" && <NodeActivityLink
                                key={`${node.id}-${node.activity_id || "none"}`}
                                node={node} activities={activities} materials={materials} onSaved={refreshNodes} />}
                              {/* Toggle liberação */}
                              <div className="flex items-center justify-between">
                                <Label htmlFor={`release-${node.id}`} className="text-sm text-muted-foreground flex items-center gap-2 cursor-pointer">
                                  {localState.isReleased
                                    ? <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                                    : <Lock className="h-3.5 w-3.5 text-rose-400" />
                                  }
                                  {localState.isReleased ? "Liberado" : "Bloqueado"}
                                </Label>
                                <Switch
                                  id={`release-${node.id}`}
                                  checked={localState.isReleased}
                                  onCheckedChange={(checked) =>
                                    setNodeReleaseState(prev => ({
                                      ...prev,
                                      [node.id]: { ...prev[node.id], isReleased: checked }
                                    }))
                                  }
                                />
                              </div>

                              {/* Campo de agendamento (só se liberado) */}
                              {localState.isReleased && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Data/hora de liberação (opcional)
                                  </Label>
                                  <div className="flex gap-1.5">
                                    <Input
                                      type="datetime-local"
                                      value={localState.scheduledDate}
                                      onChange={(e) =>
                                        setNodeReleaseState(prev => ({
                                          ...prev,
                                          [node.id]: { ...prev[node.id], scheduledDate: e.target.value }
                                        }))
                                      }
                                      className="bg-secondary border-border text-xs h-8 flex-1"
                                    />
                                    {localState.scheduledDate && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-rose-400 hover:text-rose-300 text-[10px] shrink-0"
                                        onClick={() =>
                                          setNodeReleaseState(prev => ({
                                            ...prev,
                                            [node.id]: { ...prev[node.id], scheduledDate: "" }
                                          }))
                                        }
                                      >
                                        Limpar
                                      </Button>
                                    )}
                                  </div>
                                  {node.released_at && (
                                    <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Agendado: {new Date(node.released_at).toLocaleString("pt-BR")}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground">
                                    Vazio = libera imediatamente ao salvar
                                  </p>
                                </div>
                              )}

                              {/* Botões salvar e excluir */}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  variant={isDirty ? "default" : "outline"}
                                  onClick={() => handleSaveNodeRelease(node.id)}
                                >
                                  {isDirty ? "Salvar" : "Salvo"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-rose-400 hover:text-rose-300 h-9 w-9 p-0"
                                  onClick={() => handleDeleteNode(node.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

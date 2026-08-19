"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { UsersSection } from "@/components/dashboard/users-section"
import { MemberForm } from "@/components/dashboard/member-form"
import { ContentList } from "@/components/dashboard/content-list"
import { ContentItem } from "@/components/dashboard/content-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Users, FileQuestion, LogOut, User, Shield, Compass, Lock, Unlock,
  Calendar, BookOpen, Gamepad2, Clock, CheckCircle2, ClipboardList,
  Plus, ChevronDown, ChevronUp, Trash2, ExternalLink, Link2, Upload,
  XCircle, Award, Calculator, Scale,
} from "lucide-react"

import { useNodes, utcToLocalInput } from "@/features/nodes/hooks"
import { useActivities } from "@/features/activities/hooks"
import { useUsers } from "@/features/users/hooks"
import { useMaterials } from "@/features/materials/hooks"
import type { TrainingNode } from "@/features/nodes/types"

export default function Dashboard() {
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()

  // Feature hooks
  const { materials, createMaterial, updateMaterial, deleteMaterial } = useMaterials()
  const contents: ContentItem[] = materials as unknown as ContentItem[]

  const { members, trainees, grades, createUser, updateUser, deleteUser, updateTrainee } = useUsers()

  const { nodes, nodeReleaseState, setNodeReleaseState, updateReleaseLocal, saveNodeRelease, moveNode, deleteNode, refresh: refreshNodes } = useNodes()

  const {
    activities, activitySubmissions, expandedActivity,
    createActivity, toggleActivity, deleteActivity, loadSubmissions, gradeSubmission,
  } = useActivities()

  // Local UI state
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [newActivityForm, setNewActivityForm] = useState({
    title: "", description: "", eixo: "trainee", accepts_file: true, deadline: "", material_id: "", weight: 1,
  })
  const [gradeInputs, setGradeInputs] = useState<Record<string, { grade: string; feedback: string }>>({})
  const [activityWeights, setActivityWeights] = useState<Record<string, number>>({})
  const [weightedApplying, setWeightedApplying] = useState<string | null>(null)
  const [showNodeForm, setShowNodeForm] = useState(false)
  const [nodeForm, setNodeForm] = useState({
    name: "", type: "activity" as "activity" | "material" | "game", eixo: "trainee",
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
    try {
      await updateMaterial(updated.id, {
        name: updated.name, type: updated.type, eixo: updated.eixo, text: updated.text || "",
        documents: (updated.documents || []).map((d: any) => ({ name: d.name, url: d.url })),
        videos: updated.videos || [],
      })
    } catch (e: any) { alert(e.message || "Erro ao atualizar material") }
  }

  const handleAddContent = async (newContent: ContentItem) => {
    try {
      await createMaterial({
        name: newContent.name, type: newContent.type, eixo: newContent.eixo, text: newContent.text || "",
        documents: (newContent.documents || []).map((d: any) => ({ name: d.name, url: d.url })),
        videos: newContent.videos || [],
      })
    } catch (e: any) { alert(e.message || "Erro ao adicionar material") }
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
    try {
      await createUser({ name: data.name, email: data.email, cargo: data.cargo, type: userType, eixo: data.eixo, password: data.password })
    } catch (e: any) { alert(e.message || "Erro ao adicionar membro/trainee") }
  }

  const handleUpdateTrainee = async (traineeId: string, data: { notaRotacao?: number; rotacao?: number }) => {
    try { await updateTrainee(traineeId, { notaRotacao: data.notaRotacao, rotacao: data.rotacao }) }
    catch (e: any) { alert(e.message || "Erro ao atualizar trainee") }
  }

  const handleUpdateUser = async (userId: string, data: any) => {
    try { await updateUser(userId, data) } catch (e: any) { alert(e.message || "Erro ao atualizar usuário") }
  }

  const handleDeleteUser = async (userId: string) => {
    try { await deleteUser(userId) } catch (e: any) { alert(e.message || "Erro ao excluir usuário") }
  }

  const handleCreateNode = async () => {
    let deadlineIso: string | null = null
    if (nodeForm.deadline) { const d = new Date(nodeForm.deadline); if (!isNaN(d.getTime())) deadlineIso = d.toISOString() }
    const payload: any = {
      name: nodeForm.name.trim() || null, type: nodeForm.type, eixo: nodeForm.eixo,
      activity_id: nodeForm.type === "activity" ? (nodeForm.activity_id || null) : null,
      reference_id: nodeForm.type === "material" ? (nodeForm.reference_id || null) : null,
      deadline: deadlineIso, is_released: nodeForm.is_released,
      questions: nodeForm.type === "game" ? nodeForm.questions : [],
    }
    try {
      const token = localStorage.getItem("token")
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await refreshNodes()
        setShowNodeForm(false)
        setNodeForm({ name: "", type: "activity", eixo: "trainee", activity_id: "", reference_id: "", deadline: "", is_released: false, questions: [] })
      } else { const err = await res.json(); alert(err.detail || "Erro ao criar nó") }
    } catch (e: any) { alert("Erro ao criar nó: " + (e?.message || e)) }
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
        material_id: newActivityForm.material_id || null, weight: Number(newActivityForm.weight) || 1,
      })
      setNewActivityForm({ title: "", description: "", eixo: "trainee", accepts_file: true, deadline: "", material_id: "", weight: 1 })
      setShowActivityForm(false)
    } catch (e: any) { alert(e.message || "Erro ao criar atividade") }
  }

  const handleToggleActivity = async (activityId: string, currentOpen: boolean) => {
    try { await toggleActivity(activityId, currentOpen) } catch (e: any) { alert(e.message) }
  }

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta atividade?")) return
    try { await deleteActivity(activityId) } catch (e: any) { alert(e.message) }
  }

  const handleLoadSubmissions = async (activityId: string) => {
    try { await loadSubmissions(activityId) } catch (e: any) { console.error(e) }
  }

  const handleGradeSubmission = async (activityId: string, submissionId: string) => {
    const g = gradeInputs[submissionId] || { grade: "", feedback: "" }
    const gradeNum = parseFloat(g.grade)
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 10) { alert("Nota inválida. Use um valor entre 0 e 10."); return }
    try { await gradeSubmission(activityId, submissionId, gradeNum, g.feedback) }
    catch (e: any) { alert(e.message || "Erro ao avaliar") }
  }

  const computeWeightedAvg = (traineeId: string): number | null => {
    const traineeActivities = activities.filter(a => a.eixo === "trainee" || a.eixo === "all")
    let sumGW = 0, sumW = 0
    for (const act of traineeActivities) {
      const subs = activitySubmissions[act.id] || []
      const sub = subs.find((s: any) => s.user_id === traineeId)
      if (sub && sub.grade != null) { const w = activityWeights[act.id] ?? act.weight ?? 1; sumGW += sub.grade * w; sumW += w }
    }
    return sumW > 0 ? Math.round((sumGW / sumW) * 100) / 100 : null
  }

  const handleApplyWeightedGrade = async (traineeId: string) => {
    const avg = computeWeightedAvg(traineeId)
    if (avg === null) { alert("Nenhuma nota disponível para calcular."); return }
    setWeightedApplying(traineeId)
    await handleUpdateTrainee(traineeId, { notaRotacao: avg })
    setWeightedApplying(null)
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
    experiencia: "Experiência do Consumidor", pluginfo: "PlugInfo",
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
                      <label className="text-xs text-muted-foreground">Material Relacionado (Opcional)</label>
                      <select
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
                        min="0.1"
                        step="0.5"
                        value={newActivityForm.weight}
                        onChange={e => setNewActivityForm(p => ({ ...p, weight: Number(e.target.value) }))}
                        className="bg-secondary border-border text-xs h-9"
                      />
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
                        Exige envio de arquivo (link)
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
                            <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[9px] flex items-center gap-0.5">
                              <Scale className="h-2.5 w-2.5" />Peso {act.weight ?? 1}
                            </Badge>
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

                    {isExpanded && (
                      <CardContent className="pt-0 space-y-3">
                        <div className="border-t border-border pt-3">
                          {subs.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma submissão ainda.</p>
                          ) : (
                            <div className="space-y-3">
                              {subs.map((sub: any) => {
                                const gi = gradeInputs[sub.id] || { grade: sub.grade?.toString() || "", feedback: sub.feedback || "" }
                                return (
                                  <div key={sub.id} className="rounded-lg border border-border p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-foreground">{sub.user_name}</span>
                                      {sub.submitted_at && (
                                        <span className="text-[10px] text-muted-foreground">
                                          {new Date(sub.submitted_at).toLocaleString("pt-BR")}
                                        </span>
                                      )}
                                    </div>
                                    {sub.file_url && (
                                      <a href={sub.file_url} target="_blank" rel="noopener noreferrer"
                                        className="text-xs text-primary flex items-center gap-1 hover:underline truncate">
                                        <Link2 className="h-3 w-3" />{sub.file_url}
                                      </a>
                                    )}
                                    {sub.comment && (
                                      <p className="text-xs text-muted-foreground italic">{sub.comment}</p>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <Input
                                        placeholder="Nota (0-10)"
                                        value={gi.grade}
                                        onChange={e => setGradeInputs(p => ({ ...p, [sub.id]: { ...gi, grade: e.target.value } }))}
                                        className="bg-secondary border-border text-xs h-7 w-24"
                                      />
                                      <Input
                                        placeholder="Feedback"
                                        value={gi.feedback}
                                        onChange={e => setGradeInputs(p => ({ ...p, [sub.id]: { ...gi, feedback: e.target.value } }))}
                                        className="bg-secondary border-border text-xs h-7 flex-1"
                                      />
                                      <Button size="sm" className="h-7 text-xs px-3"
                                        onClick={() => handleGradeSubmission(act.id, sub.id)}>
                                        Salvar
                                      </Button>
                                    </div>
                                    {sub.grade !== null && sub.grade !== undefined && (
                                      <p className="text-xs text-emerald-400 font-semibold">Nota atual: {sub.grade.toFixed(1)}</p>
                                    )}
                                  </div>
                                )
                              })}
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
                          <th className="text-center p-3 font-semibold text-muted-foreground">Média Atv.</th>
                          <th className="text-center p-3 font-semibold text-muted-foreground">Nota Rotação</th>
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
                              {row.avg_activity_grade != null
                                ? <span className={row.avg_activity_grade >= 7 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                                    {row.avg_activity_grade.toFixed(1)}
                                  </span>
                                : <span className="text-muted-foreground/40">—</span>
                              }
                            </td>
                            <td className="p-3 text-center">
                              {row.nota_rotacao != null
                                ? <span className={`font-bold ${row.nota_rotacao >= 7 ? "text-emerald-400" : row.nota_rotacao >= 5 ? "text-amber-400" : "text-rose-400"}`}>
                                    {row.nota_rotacao.toFixed(1)}
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
                          <th className="text-center p-3 font-semibold text-muted-foreground">Média Atv.</th>
                          <th className="text-center p-3 font-semibold text-muted-foreground">Nota Rotação</th>
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
                              {row.avg_activity_grade != null
                                ? <span className={`font-bold ${row.avg_activity_grade >= 7 ? "text-emerald-400" : "text-rose-400"}`}>{row.avg_activity_grade.toFixed(1)}</span>
                                : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="p-3 text-center">
                              {row.nota_rotacao != null
                                ? <span className={`font-bold ${row.nota_rotacao >= 7 ? "text-emerald-400" : row.nota_rotacao >= 5 ? "text-amber-400" : "text-rose-400"}`}>{row.nota_rotacao.toFixed(1)}</span>
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

            {/* Calculadora de Média Ponderada */}
            {(() => {
              const traineeActivities = activities.filter(a => a.eixo === "trainee" || a.eixo === "all")
              if (traineeActivities.length === 0) return null
              const traineeGrades = grades.filter((g: any) => g.type === "trainee")
              if (traineeGrades.length === 0) return null
              return (
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-semibold text-foreground">Calculadora de Média Ponderada</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Defina o peso de cada atividade. A média é calculada em tempo real:
                    <span className="font-mono ml-1">Σ(nota × peso) ÷ Σ(pesos)</span>
                  </p>
                  {/* Pesos das atividades */}
                  <div className="flex flex-wrap gap-3">
                    {traineeActivities.map(act => (
                      <div key={act.id} className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-2">
                        <span className="text-xs text-foreground max-w-[120px] truncate">{act.title}</span>
                        <div className="flex items-center gap-1">
                          <Scale className="h-3 w-3 text-muted-foreground" />
                          <Input
                            type="number" min="0" step="0.5"
                            value={activityWeights[act.id] ?? act.weight ?? 1}
                            onChange={e => setActivityWeights(p => ({ ...p, [act.id]: Number(e.target.value) }))}
                            className="bg-background border-border text-xs h-7 w-16 text-center"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Tabela de trainees com média calculada */}
                  <div className="rounded-xl border border-border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50">
                          <th className="text-left p-3 font-semibold text-muted-foreground">Trainee</th>
                          {traineeActivities.map(act => (
                            <th key={act.id} className="text-center p-3 font-semibold text-muted-foreground max-w-[80px]">
                              <span className="truncate block" title={act.title}>{act.title.slice(0,12)}{act.title.length>12?"…":""}</span>
                              <span className="text-[9px] text-primary">(×{activityWeights[act.id] ?? act.weight ?? 1})</span>
                            </th>
                          ))}
                          <th className="text-center p-3 font-semibold text-primary">Média Pond.</th>
                          <th className="p-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {traineeGrades.map((row: any) => {
                          // Need submissions per trainee — load lazily from activitySubmissions
                          let sumGW = 0, sumW = 0
                          traineeActivities.forEach(act => {
                            const subs = activitySubmissions[act.id] || []
                            const sub = subs.find((s: any) => s.user_id === row.id)
                            if (sub && sub.grade != null) {
                              const w = activityWeights[act.id] ?? act.weight ?? 1
                              sumGW += sub.grade * w
                              sumW += w
                            }
                          })
                          const avg = sumW > 0 ? Math.round((sumGW / sumW) * 100) / 100 : null
                          return (
                            <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/30">
                              <td className="p-3 font-medium text-foreground">{row.name}</td>
                              {traineeActivities.map(act => {
                                const subs = activitySubmissions[act.id] || []
                                const sub = subs.find((s: any) => s.user_id === row.id)
                                return (
                                  <td key={act.id} className="p-3 text-center">
                                    {sub?.grade != null
                                      ? <span className={sub.grade >= 7 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>{sub.grade.toFixed(1)}</span>
                                      : <span className="text-muted-foreground/40">—</span>}
                                  </td>
                                )
                              })}
                              <td className="p-3 text-center">
                                {avg != null
                                  ? <span className={`font-bold ${avg >= 7 ? "text-emerald-400" : avg >= 5 ? "text-amber-400" : "text-rose-400"}`}>{avg.toFixed(2)}</span>
                                  : <span className="text-muted-foreground/40">—</span>}
                              </td>
                              <td className="p-3 text-right">
                                <Button size="sm" className="h-7 text-xs px-3"
                                  disabled={avg === null || weightedApplying === row.id}
                                  onClick={() => handleApplyWeightedGrade(row.id)}>
                                  {weightedApplying === row.id ? "..." : "Aplicar"}
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    💡 "Aplicar" salva a média ponderada como Nota de Rotação do trainee. As notas das atividades aparecem após expandir os envios na aba Atividades.
                  </p>
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
                <p className="text-muted-foreground text-sm">Crie, libere ou bloqueie nós da trilha de capacitação.</p>
              </div>
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
                      <label className="text-xs text-muted-foreground">Tipo de Nó</label>
                      <select value={nodeForm.type}
                        onChange={e => setNodeForm(p => ({ ...p, type: e.target.value as any, questions: [] }))}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground">
                        <option value="activity">Atividade</option>
                        <option value="material">Material (Somente Leitura)</option>
                        <option value="game">Jogo (Quiz SPIN)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Eixo</label>
                      <select value={nodeForm.eixo}
                        onChange={e => setNodeForm(p => ({ ...p, eixo: e.target.value }))}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground">
                        <option value="trainee">Trainee</option>
                        {!isOrg && (<><option value="vendas">Vendas</option><option value="conexoes">Conexões</option><option value="experiencia">Experiência</option></>)}
                      </select>
                    </div>

                    {nodeForm.type === "activity" && (
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs text-muted-foreground font-medium">Atividade Associada *</label>
                        <select value={nodeForm.activity_id}
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
                              <option key={a.id} value={a.id}>{a.title} (Peso {a.weight ?? 1})</option>
                            ))}
                        </select>
                      </div>
                    )}

                    {nodeForm.type === "material" && (
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs text-muted-foreground">Material da Biblioteca</label>
                        <select value={nodeForm.reference_id}
                          onChange={e => {
                            const matId = e.target.value
                            const mat = contents.find(c => c.id === matId)
                            setNodeForm(p => ({ ...p, reference_id: matId, name: p.name || (mat ? mat.name : "") }))
                          }}
                          className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground">
                          <option value="">Selecione um material...</option>
                          {contents.filter(c => c.type === (nodeForm.eixo === "trainee" ? "trainee" : "membro")).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs text-muted-foreground">Nome do Nó (opcional)</label>
                      <Input placeholder="Se vazio, puxa o título da Atividade/Material selecionado" value={nodeForm.name}
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
                      <div className="sm:col-span-2 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-muted-foreground">Perguntas do Quiz</label>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() =>
                            setNodeForm(p => ({ ...p, questions: [...p.questions, { text: "", explanation: "", options: [
                              { text: "", is_correct: false, score: 0, feedback: "" },
                              { text: "", is_correct: false, score: 100, feedback: "" },
                            ]}] }))}>
                            <Plus className="h-3 w-3" />Pergunta
                          </Button>
                        </div>
                        {nodeForm.questions.map((q, qi) => (
                          <div key={qi} className="border border-border rounded-lg p-3 space-y-2 bg-secondary/30">
                            <div className="flex gap-2 items-center">
                              <Input placeholder={`Pergunta ${qi+1}`} value={q.text} className="bg-background border-border text-xs h-8 flex-1"
                                onChange={e => setNodeForm(p => { const qs=[...p.questions]; qs[qi]={...qs[qi],text:e.target.value}; return {...p,questions:qs} })} />
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-400" onClick={() =>
                                setNodeForm(p => { const qs=p.questions.filter((_,i)=>i!==qi); return {...p,questions:qs} })}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <Input placeholder="Explicação (opcional)" value={q.explanation} className="bg-background border-border text-xs h-7"
                              onChange={e => setNodeForm(p => { const qs=[...p.questions]; qs[qi]={...qs[qi],explanation:e.target.value}; return {...p,questions:qs} })} />
                            <div className="space-y-1.5 pl-2 border-l-2 border-primary/20">
                              {q.options.map((o, oi) => (
                                <div key={oi} className="flex gap-2 items-center">
                                  <input type="checkbox" checked={o.is_correct} title="Correta?"
                                    onChange={e => setNodeForm(p => { const qs=[...p.questions]; qs[qi].options[oi]={...qs[qi].options[oi],is_correct:e.target.checked,score:e.target.checked?100:0}; return {...p,questions:qs} })}
                                    className="rounded shrink-0" />
                                  <Input placeholder={`Opção ${oi+1}`} value={o.text} className="bg-background border-border text-xs h-7 flex-1"
                                    onChange={e => setNodeForm(p => { const qs=[...p.questions]; qs[qi].options[oi]={...qs[qi].options[oi],text:e.target.value}; return {...p,questions:qs} })} />
                                  <Input placeholder="Pts" type="number" value={o.score} className="bg-background border-border text-xs h-7 w-16"
                                    onChange={e => setNodeForm(p => { const qs=[...p.questions]; qs[qi].options[oi]={...qs[qi].options[oi],score:Number(e.target.value)}; return {...p,questions:qs} })} />
                                </div>
                              ))}
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary" onClick={() =>
                                setNodeForm(p => { const qs=[...p.questions]; qs[qi].options=[...qs[qi].options,{text:"",is_correct:false,score:0,feedback:""}]; return {...p,questions:qs} })}>
                                + opção
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <input type="checkbox" id="node_released" checked={nodeForm.is_released}
                        onChange={e => setNodeForm(p => ({...p, is_released: e.target.checked}))} className="rounded" />
                      <label htmlFor="node_released" className="text-xs text-muted-foreground cursor-pointer">Liberar imediatamente</label>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" size="sm" onClick={() => setShowNodeForm(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleCreateNode} disabled={
                      nodeForm.type === "activity"
                        ? (!nodeForm.activity_id && !nodeForm.name.trim())
                        : nodeForm.type === "material"
                          ? (!nodeForm.reference_id && !nodeForm.name.trim())
                          : !nodeForm.name.trim()
                    }>Criar Nó</Button>
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
                            ? new Date(node.released_at).toISOString().slice(0, 16)
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
                                  <Input
                                    type="datetime-local"
                                    value={localState.scheduledDate}
                                    onChange={(e) =>
                                      setNodeReleaseState(prev => ({
                                        ...prev,
                                        [node.id]: { ...prev[node.id], scheduledDate: e.target.value }
                                      }))
                                    }
                                    className="bg-secondary border-border text-xs h-8"
                                  />
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

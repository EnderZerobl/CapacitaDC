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
  Users,
  FileQuestion,
  LogOut,
  User,
  Shield,
  Compass,
  Lock,
  Unlock,
  Calendar,
  BookOpen,
  Gamepad2,
  Clock,
  CheckCircle2,
} from "lucide-react"

interface Member {
  id: string
  name: string
  email: string
  eixo: string
  cargo: string
  photo?: string
}

interface Trainee {
  id: string
  name: string
  email: string
  photo?: string
  notaRotacao?: number
}

interface TrainingNode {
  id: string
  name: string
  type: "material" | "game"
  eixo: string
  is_released: boolean
  released_at: string | null
  released_by: string | null
  unlocked: boolean
  completed: boolean
  user_score: number
}

export default function Dashboard() {
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()
  const [contents, setContents] = useState<ContentItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [trainees, setTrainees] = useState<Trainee[]>([])
  const [nodes, setNodes] = useState<TrainingNode[]>([])

  // Node release UI state: nodeId → { is_released, released_at_input }
  const [nodeReleaseState, setNodeReleaseState] = useState<
    Record<string, { isReleased: boolean; scheduledDate: string }>
  >({})

  const fetchData = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      // Fetch users
      const usersRes = await fetch("/api/users", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (usersRes.ok) {
        const usersData = await usersRes.json()

        const membersList = usersData
          .filter((u: any) => u.type === "membro")
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            eixo: u.eixo || "",
            cargo: u.cargo,
            photo: u.photo || ""
          }))
        setMembers(membersList)

        const traineesList = usersData
          .filter((u: any) => u.type === "trainee")
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            photo: u.photo || "",
            notaRotacao: u.nota_rotacao !== null && u.nota_rotacao !== undefined ? u.nota_rotacao : undefined,
          }))
        setTrainees(traineesList)
      }

      // Fetch materials
      const materialsRes = await fetch("/api/materials", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (materialsRes.ok) {
        const materialsData = await materialsRes.json()
        const mappedMaterials = materialsData.map((m: any) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          eixo: m.eixo,
          text: m.text,
          documents: m.documents || [],
          videos: (m.videos || []).map((v: any) => v.url)
        }))
        setContents(mappedMaterials)
      }

      // Fetch training nodes
      const nodesRes = await fetch("/api/nodes", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (nodesRes.ok) {
        const nodesData: TrainingNode[] = await nodesRes.json()
        setNodes(nodesData)
        // Initialize local release state from server data
        const initial: Record<string, { isReleased: boolean; scheduledDate: string }> = {}
        nodesData.forEach((n) => {
          initial[n.id] = {
            isReleased: n.is_released,
            scheduledDate: n.released_at
              ? new Date(n.released_at).toISOString().slice(0, 16)
              : ""
          }
        })
        setNodeReleaseState(initial)
      }
    } catch (e) {
      console.error("Erro ao carregar dados do backend:", e)
    }
  }

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login")
      } else if (user.type !== "admin" && user.type !== "organizador") {
        if (user.type === "membro") {
          router.push("/membros")
        } else {
          router.push("/trainees")
        }
      } else {
        fetchData()
      }
    }
  }, [user, isLoading, router])

  // ---------- Content handlers ----------
  const handleUpdateContent = async (updatedContent: ContentItem) => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`/api/materials/${updatedContent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          name: updatedContent.name,
          type: updatedContent.type,
          eixo: updatedContent.eixo,
          text: updatedContent.text || "",
          documents: (updatedContent.documents || []).map(doc => ({ name: doc.name, url: doc.url })),
          videos: updatedContent.videos || []
        })
      })
      if (res.ok) {
        const saved = await res.json()
        const mapped: ContentItem = {
          id: saved.id, name: saved.name, type: saved.type, eixo: saved.eixo,
          text: saved.text, documents: saved.documents || [],
          videos: (saved.videos || []).map((v: any) => v.url)
        }
        setContents(prev => prev.map(c => c.id === updatedContent.id ? mapped : c))
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao atualizar material")
      }
    } catch (e) { console.error(e) }
  }

  const handleAddContent = async (newContent: ContentItem) => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          name: newContent.name, type: newContent.type, eixo: newContent.eixo,
          text: newContent.text || "",
          documents: (newContent.documents || []).map(doc => ({ name: doc.name, url: doc.url })),
          videos: newContent.videos || []
        })
      })
      if (res.ok) {
        const created = await res.json()
        const mapped: ContentItem = {
          id: created.id, name: created.name, type: created.type, eixo: created.eixo,
          text: created.text, documents: created.documents || [],
          videos: (created.videos || []).map((v: any) => v.url)
        }
        setContents(prev => [...prev, mapped])
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao adicionar material")
      }
    } catch (e) { console.error(e) }
  }

  const handleDeleteContent = async (id: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    if (!confirm("Tem certeza que deseja excluir este material?")) return
    try {
      const res = await fetch(`/api/materials/${id}`, {
        method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        setContents(prev => prev.filter(c => c.id !== id))
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao excluir material")
      }
    } catch (e) { console.error(e) }
  }

  // ---------- Member handler ----------
  const handleAddMember = async (data: {
    name: string
    email: string
    cargo: "admin" | "organizador" | "gerente" | "membro" | "trainee"
    eixo?: "vendas" | "conexoes" | "experiencia"
  }) => {
    const token = localStorage.getItem("token")
    if (!token) return

    let userType = "membro"
    if (data.cargo === "trainee") userType = "trainee"
    else if (data.cargo === "admin") userType = "admin"
    else if (data.cargo === "organizador") userType = "organizador"

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: data.name, email: data.email, cargo: data.cargo, type: userType, eixo: data.eixo })
      })
      if (res.ok) {
        const newUser = await res.json()
        if (newUser.type === "trainee") {
          setTrainees(prev => [...prev, {
            id: newUser.id, name: newUser.name, email: newUser.email,
            photo: newUser.photo || "",
            notaRotacao: newUser.nota_rotacao !== null && newUser.nota_rotacao !== undefined ? newUser.nota_rotacao : undefined,
          }])
        } else {
          setMembers(prev => [...prev, {
            id: newUser.id, name: newUser.name, email: newUser.email,
            eixo: newUser.eixo || "", cargo: newUser.cargo, photo: newUser.photo || ""
          }])
        }
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao adicionar membro/trainee")
      }
    } catch (e) {
      console.error(e)
      alert("Erro ao conectar com o servidor")
    }
  }

  // ---------- Trainee nota handler ----------
  const handleUpdateTrainee = async (
    traineeId: string,
    data: { notaRotacao?: number }
  ) => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`/api/users/trainees/${traineeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ notaRotacao: data.notaRotacao })
      })
      if (res.ok) {
        const updated = await res.json()
        setTrainees(prev => prev.map(t =>
          t.id === traineeId
            ? { ...t, notaRotacao: updated.nota_rotacao !== null && updated.nota_rotacao !== undefined ? updated.nota_rotacao : undefined }
            : t
        ))
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao atualizar trainee")
      }
    } catch (e) { console.error(e) }
  }

  // ---------- Node release handler ----------
  const handleSaveNodeRelease = async (nodeId: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    const state = nodeReleaseState[nodeId]
    if (!state) return

    const payload: { is_released: boolean; released_at: string | null } = {
      is_released: state.isReleased,
      released_at: state.isReleased && state.scheduledDate
        ? new Date(state.scheduledDate).toISOString()
        : null
    }

    try {
      const res = await fetch(`/api/nodes/${nodeId}/release`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const updated: TrainingNode = await res.json()
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updated } : n))
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao atualizar liberação do nó")
      }
    } catch (e) { console.error(e) }
  }

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

  const isOrg = user?.type === "organizador"

  // Helper: node release status label
  function getNodeStatus(node: TrainingNode) {
    if (!node.is_released) return { label: "Bloqueado", color: "text-rose-400 border-rose-500/30", icon: Lock }
    if (node.released_at) {
      const releaseDate = new Date(node.released_at)
      if (releaseDate > new Date()) {
        return { label: `Agendado: ${releaseDate.toLocaleString("pt-BR")}`, color: "text-amber-400 border-amber-500/30", icon: Clock }
      }
    }
    return { label: "Liberado", color: "text-emerald-400 border-emerald-500/30", icon: CheckCircle2 }
  }

  // Group nodes by eixo
  const nodesByEixo: Record<string, TrainingNode[]> = {}
  nodes.forEach(n => {
    if (!nodesByEixo[n.eixo]) nodesByEixo[n.eixo] = []
    nodesByEixo[n.eixo].push(n)
  })

  const eixoLabel: Record<string, string> = {
    trainee: "Trainee (Geral)",
    vendas: "Vendas",
    conexoes: "Conexões",
    experiencia: "Experiência do Consumidor",
    pluginfo: "PlugInfo",
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
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="usuarios" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="h-4 w-4" />
              {isOrg ? "Trainees" : "Usuários"}
            </TabsTrigger>
            <TabsTrigger value="materiais" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileQuestion className="h-4 w-4" />
              Materiais
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
              onUpdateTrainee={handleUpdateTrainee}
            />
          </TabsContent>

          {/* Seção Materiais */}
          <TabsContent value="materiais" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Materiais</h2>
              <p className="text-muted-foreground">
                {isOrg ? "Gerencie os materiais específicos do PlugInfo" : "Gerencie os materiais disponíveis para membros e trainees"}
              </p>
            </div>
            <ContentList
              contents={contents}
              onUpdateContent={handleUpdateContent}
              onAddContent={handleAddContent}
              onDeleteContent={handleDeleteContent}
              userType={user?.type}
            />
          </TabsContent>

          {/* Seção Trilha — Gerenciamento de liberação de nós */}
          <TabsContent value="trilha" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Gerenciamento da Trilha</h2>
              <p className="text-muted-foreground">
                Libere ou bloqueie cada nó da trilha de capacitação. Você pode liberar imediatamente ou agendar uma data e hora.
              </p>
            </div>

            {nodes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Compass className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum nó de trilha cadastrado ainda.</p>
              </div>
            ) : (
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
                        const isDirty =
                          localState.isReleased !== node.is_released ||
                          (localState.scheduledDate
                            ? new Date(localState.scheduledDate).toISOString()
                            : null) !== node.released_at

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
                                  <CardTitle className="text-sm font-semibold text-foreground truncate">
                                    {node.name}
                                  </CardTitle>
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

                              {/* Botão salvar */}
                              <Button
                                size="sm"
                                className="w-full"
                                variant={isDirty ? "default" : "outline"}
                                onClick={() => handleSaveNodeRelease(node.id)}
                              >
                                {isDirty ? "Salvar alteração" : "Salvo"}
                              </Button>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

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
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  Link2,
  Upload,
  XCircle,
  Award,
  Calculator,
  Scale,
} from "lucide-react"

interface Member {
  id: string
  name: string
  email: string
  eixo: string
  cargo: string
  type: string
  photo?: string
}

interface Trainee {
  id: string
  name: string
  email: string
  photo?: string
  notaRotacao?: number
  rotacao?: number | null
}

interface TrainingNode {
  id: string
  name: string
  type: "activity" | "material" | "game"
  eixo: string
  reference_id?: string | null
  activity_id?: string | null
  deadline?: string | null
  order_index?: number
  is_released: boolean
  released_at: string | null
  released_by: string | null
  unlocked: boolean
  completed: boolean
  user_score: number
}

/** Converts a UTC ISO string to the local "YYYY-MM-DDTHH:mm" format
 * used by datetime-local inputs, so the displayed time matches the
 * user's local timezone instead of UTC. */
function utcToLocalInput(utcIso: string): string {
  const d = new Date(utcIso)
  // Shift by the local timezone offset to get local time as if it were UTC
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function Dashboard() {
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()
  const [contents, setContents] = useState<ContentItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [trainees, setTrainees] = useState<Trainee[]>([])
  const [nodes, setNodes] = useState<TrainingNode[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)
  const [activitySubmissions, setActivitySubmissions] = useState<Record<string, any[]>>({})

  // New activity form state
  const [newActivityForm, setNewActivityForm] = useState({
    title: "",
    description: "",
    eixo: "trainee",
    accepts_file: true,
    deadline: "",
    material_id: "",
    weight: 1,
  })
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [gradeInputs, setGradeInputs] = useState<Record<string, { grade: string; feedback: string }>>({})
  const [grades, setGrades] = useState<any[]>([])

  // Node release UI state: nodeId → { is_released, released_at_input }
  const [nodeReleaseState, setNodeReleaseState] = useState<
    Record<string, { isReleased: boolean; scheduledDate: string }>
  >({})

  // ---------- New Node form state ----------
  const [showNodeForm, setShowNodeForm] = useState(false)
  const [nodeForm, setNodeForm] = useState({
    name: "",
    type: "activity" as "activity" | "material" | "game",
    eixo: "trainee",
    activity_id: "",
    reference_id: "",
    deadline: "",
    is_released: false,
    questions: [] as Array<{
      text: string
      explanation: string
      options: Array<{ text: string; is_correct: boolean; score: number; feedback: string }>
    }>,
  })

  // ---------- Weighted grade calculator state ----------
  // activityId → weight (number, default 1)
  const [activityWeights, setActivityWeights] = useState<Record<string, number>>({})
  const [weightedApplying, setWeightedApplying] = useState<string | null>(null)

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
          .filter((u: any) => u.type !== "trainee")
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            eixo: u.eixo || "",
            cargo: u.cargo,
            type: u.type,
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
            rotacao: u.rotacao ?? null,
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
            scheduledDate: n.released_at ? utcToLocalInput(n.released_at) : ""
          }
        })
        setNodeReleaseState(initial)
      }

      // Fetch activities
      const activitiesRes = await fetch("/api/activities", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (activitiesRes.ok) {
        setActivities(await activitiesRes.json())
      }

      // Fetch grades
      const gradesRes = await fetch("/api/grades", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (gradesRes.ok) {
        setGrades(await gradesRes.json())
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
    cargo: "admin" | "organizador" | "membro" | "trainee"
    password?: string
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
        body: JSON.stringify({ name: data.name, email: data.email, cargo: data.cargo, type: userType, eixo: data.eixo, password: data.password })
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
            eixo: newUser.eixo || "", cargo: newUser.cargo, type: newUser.type || "membro", photo: newUser.photo || ""
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

  // ---------- Trainee nota + rotacao handler ----------
  const handleUpdateTrainee = async (
    traineeId: string,
    data: { notaRotacao?: number; rotacao?: number }
  ) => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`/api/users/trainees/${traineeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ notaRotacao: data.notaRotacao, rotacao: data.rotacao })
      })
      if (res.ok) {
        const updated = await res.json()
        setTrainees(prev => prev.map(t =>
          t.id === traineeId
            ? {
                ...t,
                notaRotacao: updated.nota_rotacao != null ? updated.nota_rotacao : undefined,
                rotacao: updated.rotacao ?? null,
              }
            : t
        ))
        // Refresh grades
        const gr = await fetch("/api/grades", { headers: { "Authorization": `Bearer ${token}` } })
        if (gr.ok) setGrades(await gr.json())
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao atualizar trainee")
      }
    } catch (e) { console.error(e) }
  }

  const handleUpdateUser = async (userId: string, data: any) => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data)
      })
      if (res.ok) {
        await fetchData()
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao atualizar usuário")
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        await fetchData()
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao excluir usuário")
      }
    } catch (e) {
      console.error(e)
    }
  }

  // ---------- Node create / delete handlers ----------
  const handleCreateNode = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    let deadlineIso: string | null = null
    if (nodeForm.deadline) {
      const d = new Date(nodeForm.deadline)
      if (!isNaN(d.getTime())) {
        deadlineIso = d.toISOString()
      }
    }

    const payload: any = {
      name: nodeForm.name.trim() || null,
      type: nodeForm.type,
      eixo: nodeForm.eixo,
      activity_id: nodeForm.type === "activity" ? (nodeForm.activity_id || null) : null,
      reference_id: nodeForm.type === "material" ? (nodeForm.reference_id || null) : null,
      deadline: deadlineIso,
      is_released: nodeForm.is_released,
      questions: nodeForm.type === "game" ? nodeForm.questions : [],
    }
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created = await res.json()
        setNodes(prev => [...prev, created])
        setNodeReleaseState(prev => ({
          ...prev,
          [created.id]: { isReleased: created.is_released, scheduledDate: "" }
        }))
        setShowNodeForm(false)
        setNodeForm({ name: "", type: "activity", eixo: "trainee", activity_id: "", reference_id: "", deadline: "", is_released: false, questions: [] })
      } else {
        const text = await res.text()
        try {
          const err = JSON.parse(text)
          alert(err.detail || "Erro ao criar nó")
        } catch {
          alert("Erro no servidor: " + (text || res.statusText))
        }
      }
    } catch (e: any) {
      console.error(e)
      alert("Erro ao criar nó: " + (e?.message || e))
    }
  }

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm("Tem certeza que deseja excluir este nó da trilha?")) return
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`/api/nodes/${nodeId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      })
      if (res.ok) {
        setNodes(prev => prev.filter(n => n.id !== nodeId))
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao excluir nó")
      }
    } catch (e) { console.error(e) }
  }

  // ---------- Weighted average handler ----------
  // Given trainee activities from /api/activities (with grades via submissions),
  // compute: Σ(grade × weight) / Σ(weight) for activities with a grade
  const computeWeightedAvg = (traineeId: string): number | null => {
    const traineeActivities = activities.filter(a => {
      // Get trainee's rotation to filter by eixo
      const t = trainees.find(t => t.id === traineeId)
      return a.eixo === "trainee" || a.eixo === "all"
    })
    let sumGW = 0, sumW = 0
    for (const act of traineeActivities) {
      const subs = activitySubmissions[act.id] || []
      const sub = subs.find((s: any) => s.user_id === traineeId)
      if (sub && sub.grade != null) {
        const w = activityWeights[act.id] ?? act.weight ?? 1
        sumGW += sub.grade * w
        sumW += w
      }
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
        // Sync local release state so isDirty computes to false.
        // Convert server UTC date back to local time (same format as datetime-local input)
        setNodeReleaseState(prev => ({
          ...prev,
          [nodeId]: {
            isReleased: updated.is_released,
            scheduledDate: updated.released_at ? utcToLocalInput(updated.released_at) : ""
          }
        }))
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao atualizar liberação do nó")
      }
    } catch (e) { console.error(e) }
  }

  const handleMoveNode = async (nodeId: string, direction: "up" | "down", eixo: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    const eixoNodes = nodes.filter(n => n.eixo === eixo).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const index = eixoNodes.findIndex(n => n.id === nodeId)
    if (index === -1) return
    let targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= eixoNodes.length) return

    const currentNode = eixoNodes[index]
    const targetNode = eixoNodes[targetIndex]

    const curIdx = currentNode.order_index ?? 0
    const tarIdx = targetNode.order_index ?? 0

    let newCurIdx = tarIdx
    let newTarIdx = curIdx
    if (curIdx === tarIdx) {
      newCurIdx = direction === "up" ? curIdx - 1 : curIdx + 1
      newTarIdx = curIdx
    }

    try {
      await Promise.all([
        fetch(`/api/nodes/${currentNode.id}/order`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ order_index: newCurIdx })
        }),
        fetch(`/api/nodes/${targetNode.id}/order`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ order_index: newTarIdx })
        })
      ])

      const nodesRes = await fetch("/api/nodes", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (nodesRes.ok) {
        setNodes(await nodesRes.json())
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  // ---------- Activity handlers ----------
  const handleCreateActivity = async () => {
    const token = localStorage.getItem("token")
    if (!token) return
    const payload = {
      title: newActivityForm.title,
      description: newActivityForm.description,
      eixo: newActivityForm.eixo,
      accepts_file: newActivityForm.accepts_file,
      deadline: newActivityForm.deadline ? new Date(newActivityForm.deadline).toISOString() : null,
      material_id: newActivityForm.material_id || null,
      weight: Number(newActivityForm.weight) || 1,
    }
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const created = await res.json()
        setActivities(prev => [created, ...prev])
        setNewActivityForm({ title: "", description: "", eixo: "trainee", accepts_file: true, deadline: "", material_id: "", weight: 1 })
        setShowActivityForm(false)
      } else {
        const err = await res.json()
        alert(err.detail || "Erro ao criar atividade")
      }
    } catch (e) { console.error(e) }
  }

  const handleToggleActivity = async (activityId: string, currentOpen: boolean) => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ is_open: !currentOpen })
      })
      if (res.ok) {
        const updated = await res.json()
        setActivities(prev => prev.map(a => a.id === activityId ? updated : a))
      }
    } catch (e) { console.error(e) }
  }

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta atividade?")) return
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) setActivities(prev => prev.filter(a => a.id !== activityId))
    } catch (e) { console.error(e) }
  }

  const handleLoadSubmissions = async (activityId: string) => {
    if (expandedActivity === activityId) { setExpandedActivity(null); return }
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`/api/activities/${activityId}/submissions`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const subs = await res.json()
        setActivitySubmissions(prev => ({ ...prev, [activityId]: subs }))
        setExpandedActivity(activityId)
      }
    } catch (e) { console.error(e) }
  }

  const handleGradeSubmission = async (activityId: string, submissionId: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    const g = gradeInputs[submissionId] || { grade: "", feedback: "" }
    const gradeNum = parseFloat(g.grade)
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 10) {
      alert("Nota inválida. Use um valor entre 0 e 10.")
      return
    }
    try {
      const res = await fetch(`/api/activities/${activityId}/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ grade: gradeNum, feedback: g.feedback })
      })
      if (res.ok) {
        const updated = await res.json()
        setActivitySubmissions(prev => ({
          ...prev,
          [activityId]: (prev[activityId] || []).map(s => s.id === submissionId ? updated : s)
        }))
      }
    } catch (e) { console.error(e) }
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

  // Group nodes by eixo and sort by order_index
  const nodesByEixo: Record<string, TrainingNode[]> = {}
  const filteredNodes = isOrg ? nodes.filter(n => n.eixo === "trainee") : nodes
  filteredNodes.forEach(n => {
    if (!nodesByEixo[n.eixo]) nodesByEixo[n.eixo] = []
    nodesByEixo[n.eixo].push(n)
  })
  Object.keys(nodesByEixo).forEach(key => {
    nodesByEixo[key].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
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

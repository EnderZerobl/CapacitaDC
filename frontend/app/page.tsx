"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { UsersSection } from "@/components/dashboard/users-section"
import { MemberForm } from "@/components/dashboard/member-form"
import { ContentList } from "@/components/dashboard/content-list"
import { ContentItem } from "@/components/dashboard/content-card"
import { contentData } from "@/lib/content-data"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, FileQuestion, LayoutGrid, LogOut, User, Shield } from "lucide-react"

// Dados de exemplo - Membros
const initialMembers = [
  {
    id: "1",
    name: "Ana Carolina Silva",
    eixo: "Vendas",
    cargo: "Líder de Vendas",
    photo: "",
  },
  {
    id: "2",
    name: "Bruno Mendes",
    eixo: "Conexões",
    cargo: "Analista de Parcerias",
    photo: "",
  },
  {
    id: "3",
    name: "Carla Ferreira",
    eixo: "Experiência do Consumidor",
    cargo: "Gestora de CX",
    photo: "",
  },
  {
    id: "4",
    name: "Diego Santos",
    eixo: "Vendas",
    cargo: "Consultor de Vendas",
    photo: "",
  },
  {
    id: "5",
    name: "Eduarda Lima",
    eixo: "Conexões",
    cargo: "Executiva de Parcerias",
    photo: "",
  },
  {
    id: "6",
    name: "Felipe Costa",
    eixo: "Experiência do Consumidor",
    cargo: "Coordenador de Sucesso do Cliente",
    photo: "",
  },
]

// Dados de exemplo - Trainees
const initialTrainees = [
  { id: "1", name: "Gabriel Oliveira", photo: "" },
  { id: "2", name: "Helena Rocha", photo: "" },
  { id: "3", name: "Igor Almeida", photo: "" },
  { id: "4", name: "Julia Martins", photo: "" },
]

// Convert contentData to ContentItem format
const initialContents: ContentItem[] = contentData.map((item) => ({
  id: item.id,
  name: item.name,
  type: item.type,
  eixo: item.eixo,
  text: item.text,
  documents: item.documents,
  videos: item.videos,
}))

interface Member {
  id: string
  name: string
  email: string
  eixo: string
  cargo: string
  photo?: string
}

interface TraineeActivity {
  id: string
  name: string
  completed: boolean
}

interface Trainee {
  id: string
  name: string
  email: string
  photo?: string
  notaRotacao?: number
  atividades?: TraineeActivity[]
}

export default function Dashboard() {
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()
  const [contents, setContents] = useState<ContentItem[]>(initialContents)
  const [members, setMembers] = useState<Member[]>(
    initialMembers.map((m) => ({ ...m, email: "" }))
  )
  const [trainees, setTrainees] = useState<Trainee[]>(
    initialTrainees.map((t) => ({ ...t, email: "" }))
  )

  const handleUpdateContent = (updatedContent: ContentItem) => {
    setContents(
      contents.map((c) => (c.id === updatedContent.id ? updatedContent : c))
    )
  }

  const handleAddContent = (newContent: ContentItem) => {
    setContents([...contents, newContent])
  }

  const eixoLabels: Record<string, string> = {
    vendas: "Vendas",
    conexoes: "Conexões",
    experiencia: "Experiência do Consumidor",
  }

  const handleAddMember = (data: {
    name: string
    email: string
    cargo: "gerente" | "membro" | "trainee"
    eixo?: "vendas" | "conexoes" | "experiencia"
  }) => {
    if (data.cargo === "trainee") {
      const newTrainee: Trainee = {
        id: `trainee-${Date.now()}`,
        name: data.name,
        email: data.email,
        photo: "",
      }
      setTrainees([...trainees, newTrainee])
    } else {
      const newMember: Member = {
        id: `member-${Date.now()}`,
        name: data.name,
        email: data.email,
        eixo: data.eixo ? eixoLabels[data.eixo] : "",
        cargo: data.cargo === "gerente" ? "Gerente" : "Membro",
        photo: "",
      }
      setMembers([...members, newMember])
    }
  }

  const handleUpdateTrainee = (
    traineeId: string,
    data: { notaRotacao?: number; atividades: TraineeActivity[] }
  ) => {
    setTrainees(
      trainees.map((t) =>
        t.id === traineeId
          ? { ...t, notaRotacao: data.notaRotacao, atividades: data.atividades }
          : t
      )
    )
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
                <h1 className="text-xl font-bold text-foreground">Dashboard Admin</h1>
                <p className="text-sm text-muted-foreground">
                  Gestão Comercial
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.name}</span>
                  <Badge variant="outline" className="text-primary border-primary/30">
                    Admin
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
              Usuários
            </TabsTrigger>
            <TabsTrigger value="materiais" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileQuestion className="h-4 w-4" />
              Materiais
            </TabsTrigger>
          </TabsList>

          {/* Seção Usuários */}
          <TabsContent value="usuarios" className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">Usuários</h2>
                <p className="text-muted-foreground">
                  Gerencie os membros e trainees do setor comercial
                </p>
              </div>
              <MemberForm onSubmit={handleAddMember} />
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
              <h2 className="text-2xl font-bold text-foreground">
                Materiais
              </h2>
              <p className="text-muted-foreground">
                Gerencie os materiais disponíveis para membros e trainees
              </p>
            </div>
            <ContentList
              contents={contents}
              onUpdateContent={handleUpdateContent}
              onAddContent={handleAddContent}
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

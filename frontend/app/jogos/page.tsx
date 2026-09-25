"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { GameLibrary } from "@/components/games/game-library"
import { useAuth } from "@/lib/auth-context"
import { homePath, isStaff, managerAxis } from "@/lib/roles"

export default function GamesPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const canAuthor = isStaff(user?.type)
  useEffect(() => {
    if (isLoading) return
    if (!user) router.replace("/login")
    else if (!canAuthor) router.replace(homePath(user.type))
  }, [isLoading, user, canAuthor, router])
  if (isLoading || !canAuthor) return <div className="flex min-h-screen items-center justify-center text-muted-foreground" role="status">Carregando…</div>
  return <main className="mx-auto min-h-screen max-w-6xl space-y-7 px-4 py-8 sm:px-6">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Voltar ao painel</Link>
    <header className="space-y-2"><h1 className="text-3xl font-bold">Biblioteca de jogos</h1><p className="max-w-3xl text-muted-foreground">Crie formatos interativos para as trilhas, organize seus rascunhos e publique versões para os participantes.</p></header>
    <GameLibrary key={`${user?.id}:${user?.type}:${user?.eixo ?? ""}`}
      isOrganizer={user?.type === "organizador"} managerAxis={managerAxis(user)} />
  </main>
}

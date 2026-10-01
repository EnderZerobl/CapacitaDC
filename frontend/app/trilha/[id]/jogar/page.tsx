"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { homePath, isStaff } from "@/lib/roles"
import { nodesApi } from "@/features/nodes/api"
import { useNodes } from "@/features/nodes/hooks"
import { LibraryGame } from "@/components/games/library-game"
import { SpinGame } from "@/components/games/spin-game"
import { GameMaterial } from "@/components/games/game-material"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

export default function PlayGamePage() {
  const { id } = useParams<{ id: string }>()
  const { user, isLoading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (isLoading) return
    if (!user) router.replace("/login")
    else if (isStaff(user.type)) router.replace(homePath(user.type))
  }, [user, isLoading, router])

  if (isLoading || !user || isStaff(user.type)) {
    return <main className="flex min-h-screen items-center justify-center" role="status">Carregando…</main>
  }
  return <GamePageContent key={`${user.id}:${user.type}:${user.eixo}:${id}`} nodeId={id} />
}

function GamePageContent({ nodeId }: { nodeId: string }) {
  const { user, refreshUser } = useAuth()
  const { nodes, loading, error, refresh } = useNodes()
  const router = useRouter()
  const node = nodes.find(item => item.id === nodeId)
  const trailPath = homePath(user?.type)
  const returnToTrail = () => router.push(trailPath)
  const complete = async () => {
    await Promise.allSettled([refreshUser()])
    returnToTrail()
  }

  return <main className="min-h-screen bg-background">
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href={trailPath} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Voltar à trilha</Link>
        <ThemeToggle />
      </div>
    </header>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {loading && !node ? <p role="status">Carregando jogo…</p>
        : error && !node ? <div role="alert" className="space-y-4"><p className="text-destructive">{error}</p><Button onClick={() => void refresh()}>Tentar novamente</Button></div>
        : !node || node.type !== "game" ? <h1 className="text-xl font-semibold">Jogo não encontrado nesta trilha.</h1>
        : !node.unlocked ? <div className="space-y-3"><h1 className="text-xl font-semibold">Este jogo ainda está bloqueado.</h1><p className="text-muted-foreground">Conclua as etapas anteriores e aguarde a liberação para jogar.</p><Button variant="outline" onClick={() => void refresh()}>Verificar liberação</Button></div>
        : <>
          <h1 className="text-2xl font-bold sm:text-3xl">{node.name}</h1>
          <p className="text-sm text-muted-foreground">{node.is_required === false ? "Opcional · não entra na média" : `Obrigatório · peso ${node.weight ?? 1}`} · {node.allow_retry === false ? "Tentativa única" : "Repetição permitida · vale a melhor nota"}</p>
          {node.reference_id && <GameMaterial nodeId={node.id} />}
          {node.game_revision_id
            ? <LibraryGame nodeId={node.id} allowRetry={node.allow_retry !== false} onCompleted={complete} onClose={returnToTrail} />
            : node.completed && node.allow_retry === false ? <div className="space-y-3 rounded-lg border p-6"><h2 className="text-xl font-semibold">Jogo concluído</h2>{node.grade != null && <p>Nota: {node.grade.toFixed(2)} / 10</p>}<p className="text-muted-foreground">A repetição deste jogo não está permitida.</p></div>
            : <SpinGame nodeName={node.name} allowRetry={node.allow_retry !== false} questions={node.questions}
                onComplete={answers => nodesApi.submitGame(node.id, { answers })} onClose={() => void complete()} />}
        </>}
    </div>
  </main>
}

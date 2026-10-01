"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GameDraft } from "@/features/games/types"
import { GamePreview } from "./game-preview"

export function GamePreviewScreen({ draft, onClose, backLabel }: { draft: GameDraft; onClose: () => void; backLabel: string }) {
  return <section aria-label="Prévia do jogo" className="min-h-[70vh] space-y-6">
    <Button autoFocus variant="outline" onClick={onClose}><ArrowLeft className="size-4" />{backLabel}</Button>
    <div className="space-y-2"><p className="text-sm text-muted-foreground">Pré-visualizar jogo</p><h2 className="text-2xl font-bold sm:text-3xl">{draft.title || "Jogo sem título"}</h2></div>
    <div className="rounded-xl border bg-card p-4 sm:p-6"><GamePreview draft={draft} /></div>
  </section>
}

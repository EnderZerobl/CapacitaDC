"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LinkedText, safeHref } from "@/components/content/linked-text"
import { useNodeContent } from "@/features/nodes/hooks"
import { openAuthenticatedFile } from "@/lib/api-client"

export function GameMaterial({ nodeId }: { nodeId: string }) {
  const { content, loading, error, refresh } = useNodeContent(nodeId)
  const [fileError, setFileError] = useState("")
  if (loading) return <p role="status" className="text-sm text-muted-foreground">Carregando material de apoio…</p>
  if (error) return <div role="alert" className="space-y-2 text-sm"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => void refresh()}>Tentar carregar material novamente</Button></div>
  const material = content?.material
  if (!material) return null
  return <details className="rounded-lg border p-4">
    <summary className="cursor-pointer font-medium">Material de apoio: {material.name}</summary>
    <div className="mt-4 space-y-3 text-sm">
      {material.text && <LinkedText text={material.text} />}
      {material.videos.filter(url => safeHref(url)).map((url, index) => <a key={`${index}-${url}`} className="block text-primary underline" href={safeHref(url)!} target="_blank" rel="noopener noreferrer">Vídeo {index + 1}</a>)}
      {material.documents.map((document, index) => <Button key={`${index}-${document.url}`} variant="outline" className="mr-2" onClick={async () => {
        setFileError("")
        try { await openAuthenticatedFile(document.url) }
        catch (cause) { setFileError(cause instanceof Error ? cause.message : "Não foi possível abrir o documento.") }
      }}>{document.name}</Button>)}
      {fileError && <p role="alert" className="text-destructive">{fileError}</p>}
    </div>
  </details>
}

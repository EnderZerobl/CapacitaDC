"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  FileText,
  Video,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react"
import { openAuthenticatedFile } from "@/lib/api-client"
import { LinkedText, safeHref } from "@/components/content/linked-text"
import { type ContentItem, eixoLabels, eixoColors } from "@/lib/content-data"

interface ViewContentCardProps {
  content: ContentItem
}

export function ViewContentCard({ content }: ViewContentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [openError, setOpenError] = useState("")

  // Extract a friendly label from a video URL
  const getVideoLabel = (url: string, index: number): string => {
    try {
      const u = new URL(url)
      // YouTube: ?v=ID or youtu.be/ID
      const ytId = u.searchParams.get("v") || (u.hostname === "youtu.be" ? u.pathname.slice(1) : null)
      if (ytId) return `YouTube — ${ytId}`
      // Vimeo
      if (u.hostname.includes("vimeo")) return `Vimeo — ${u.pathname.split("/").filter(Boolean).pop() || "vídeo"}`
      // Generic: show hostname + path truncated
      const path = (u.pathname || "").replace(/^\//,"").slice(0, 40)
      return `${u.hostname}${path ? " / " + path : ""}`
    } catch {
      // Not a valid URL or plain text — show truncated
      return url.length > 60 ? url.slice(0, 57) + "…" : url
    }
  }

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-lg font-semibold text-foreground">
              {content.name}
            </CardTitle>
            <Badge 
              variant="outline" 
              className={eixoColors[content.eixo]}
            >
              {eixoLabels[content.eixo]}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Recolher
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Ver mais
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Text Content */}
          {content.text && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Conteúdo
              </h4>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                <LinkedText text={content.text} />
              </p>
            </div>
          )}

          {/* Documents */}
          {(content.documents?.length ?? 0) > 0 && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Documentos ({content.documents.length})
                </h4>
                <div className="space-y-2">
                  {content.documents.map((doc, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => void openAuthenticatedFile(doc.url).catch(() => setOpenError("Não foi possível abrir o documento."))}
                      className="flex w-full items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group text-left"
                    >
                      <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-foreground flex-1">
                        {doc.name}
                      </span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </button>
                  ))}
                </div>
                {openError && <p role="alert" className="text-xs text-destructive">{openError}</p>}
              </div>
            </>
          )}

          {/* Videos */}
          {(content.videos?.length ?? 0) > 0 && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Vídeos ({content.videos.length})
                </h4>
                <div className="space-y-2">
                  {content.videos.filter(video => safeHref(video)).map((video, index) => (
                    <a
                      key={index}
                      href={safeHref(video)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={video}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
                    >
                      <div className="h-8 w-8 rounded bg-red-500/20 flex items-center justify-center shrink-0">
                        <Video className="h-4 w-4 text-red-400" />
                      </div>
                      <span className="text-sm text-foreground flex-1 truncate">
                        {getVideoLabel(video, index)}
                      </span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

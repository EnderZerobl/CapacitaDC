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
import { type ContentItem, eixoLabels, eixoColors } from "@/lib/content-data"

interface ViewContentCardProps {
  content: ContentItem
}

export function ViewContentCard({ content }: ViewContentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

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
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {content.text}
              </p>
            </div>
          )}

          {/* Documents */}
          {content.documents.length > 0 && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Documentos ({content.documents.length})
                </h4>
                <div className="space-y-2">
                  {content.documents.map((doc, index) => (
                    <a
                      key={index}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
                    >
                      <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-foreground flex-1">
                        {doc.name}
                      </span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Videos */}
          {content.videos.length > 0 && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Vídeos ({content.videos.length})
                </h4>
                <div className="space-y-2">
                  {content.videos.map((video, index) => (
                    <a
                      key={index}
                      href={video}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
                    >
                      <div className="h-8 w-8 rounded bg-red-500/20 flex items-center justify-center">
                        <Video className="h-4 w-4 text-red-400" />
                      </div>
                      <span className="text-sm text-foreground flex-1 truncate">
                        {video}
                      </span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
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

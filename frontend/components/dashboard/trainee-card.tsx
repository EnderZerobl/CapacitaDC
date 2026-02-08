"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, ClipboardList } from "lucide-react"

export interface TraineeActivity {
  id: string
  name: string
  completed: boolean
}

interface TraineeCardProps {
  name: string
  photo?: string
  notaRotacao?: number
  atividades?: TraineeActivity[]
}

export function TraineeCard({ name, photo, notaRotacao, atividades = [] }: TraineeCardProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const completedCount = atividades.filter((a) => a.completed).length

  return (
    <Card className="border-border/50 bg-card hover:border-primary/50 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 border-2 border-muted">
            <AvatarImage src={photo || "/placeholder.svg"} alt={name} />
            <AvatarFallback className="bg-muted text-muted-foreground font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">{name}</h3>
            <span className="text-xs text-muted-foreground">Trainee</span>
            
            <div className="mt-3 space-y-2">
              {/* Nota da Rotação */}
              {notaRotacao !== undefined && (
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs text-muted-foreground">Nota da Rotação:</span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      notaRotacao >= 8 
                        ? "border-emerald-500/30 text-emerald-400" 
                        : notaRotacao >= 6 
                        ? "border-amber-500/30 text-amber-400" 
                        : "border-rose-500/30 text-rose-400"
                    }`}
                  >
                    {notaRotacao.toFixed(1)}
                  </Badge>
                </div>
              )}

              {/* Atividades */}
              {atividades.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Atividades: {completedCount}/{atividades.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {atividades.slice(0, 3).map((atividade) => (
                      <Badge
                        key={atividade.id}
                        variant="outline"
                        className={`text-[10px] ${
                          atividade.completed
                            ? "border-emerald-500/30 text-emerald-400"
                            : "border-muted text-muted-foreground"
                        }`}
                      >
                        {atividade.name}
                      </Badge>
                    ))}
                    {atividades.length > 3 && (
                      <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground">
                        +{atividades.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

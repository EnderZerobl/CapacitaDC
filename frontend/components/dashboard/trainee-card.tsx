"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"

interface TraineeCardProps {
  name: string
  photo?: string
  notaRotacao?: number
}

export function TraineeCard({ name, photo, notaRotacao }: TraineeCardProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

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

            <div className="mt-3">
              {notaRotacao !== undefined ? (
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
              ) : (
                <span className="text-xs text-muted-foreground/60 italic">Sem nota ainda</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

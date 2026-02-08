"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"

interface MemberCardProps {
  name: string
  eixo: string
  cargo: string
  photo?: string
}

export function MemberCard({ name, eixo, cargo, photo }: MemberCardProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <Card className="border-border/50 bg-card hover:border-primary/50 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 border-2 border-primary/30">
            <AvatarImage src={photo || "/placeholder.svg"} alt={name} />
            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{name}</h3>
            <p className="text-sm text-muted-foreground truncate">{cargo}</p>
            <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium bg-primary/20 text-primary rounded-full">
              {eixo}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

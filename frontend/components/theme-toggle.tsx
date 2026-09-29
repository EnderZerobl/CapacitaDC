"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Alterna entre o tema claro e o escuro; a escolha fica salva neste navegador. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  // O tema só é conhecido no navegador: antes disso o botão não mostra um ícone errado.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = resolvedTheme !== "light"
  const label = !mounted ? "Alternar tema" : isDark ? "Usar tema claro" : "Usar tema escuro"

  return (
    <Button type="button" variant="ghost" size="sm" aria-label={label} title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("text-muted-foreground hover:text-foreground", className)}>
      {mounted ? (isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <span className="h-4 w-4" />}
    </Button>
  )
}

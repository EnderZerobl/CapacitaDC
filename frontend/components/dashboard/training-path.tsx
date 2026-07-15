"use client"

import { BookOpen, Gamepad2, Lock, Check, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Question {
  id: string
  text: string
  options: any[]
}

interface TrainingNode {
  id: string
  name: string
  type: "material" | "game"
  reference_id?: string
  eixo: string
  prerequisite_node_id?: string
  x_pos: number
  y_pos: number
  completed: boolean
  unlocked: boolean
  user_score: number
  questions: Question[]
  is_released?: boolean
  released_at?: string | null
}

interface TrainingPathProps {
  nodes: TrainingNode[]
  onSelectNode: (node: TrainingNode) => void
  highlighted?: boolean
  axisName?: string
}

export function TrainingPath({ nodes, onSelectNode, highlighted = false, axisName }: TrainingPathProps) {
  // Constants for fixed width 360px centering
  const containerWidth = 360
  const centerX = containerWidth / 2
  const stepY = 120
  const stepX = 70
  const startY = 40

  // Calculate container height dynamically
  const maxY = nodes.reduce((max, node) => (node.y_pos > max ? node.y_pos : max), 0)
  const containerHeight = maxY * stepY + startY + 80

  // Helper to get coordinates
  const getNodeCoords = (node: TrainingNode) => {
    const x = centerX + node.x_pos * stepX
    const y = node.y_pos * stepY + startY
    return { x, y }
  }

  return (
    <div 
      className={`relative p-6 rounded-2xl bg-card border-2 transition-all duration-300 ${
        highlighted 
          ? "border-primary/50 shadow-lg shadow-primary/5 bg-gradient-to-b from-card to-primary/5 animate-pulse-subtle" 
          : "border-border shadow-sm"
      }`}
    >
      {axisName && (
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg flex items-center space-x-2 text-foreground">
            <span>Trilha: {axisName}</span>
            {highlighted && (
              <span className="text-[10px] bg-primary text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Seu Eixo
              </span>
            )}
          </h3>
        </div>
      )}

      <div 
        className="relative mx-auto overflow-visible"
        style={{ width: `${containerWidth}px`, height: `${containerHeight}px` }}
      >
        {/* SVG Connecting Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          {nodes.map((node) => {
            if (!node.prerequisite_node_id) return null
            const prereq = nodes.find((n) => n.id === node.prerequisite_node_id)
            if (!prereq) return null

            const start = getNodeCoords(prereq)
            const end = getNodeCoords(node)

            // Line styles based on unlock status
            const isLineUnlocked = prereq.completed
            const strokeColor = isLineUnlocked 
              ? "var(--primary)" 
              : "var(--border)"
            
            return (
              <g key={`line-${prereq.id}-${node.id}`}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={strokeColor}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={isLineUnlocked ? "none" : "6,6"}
                  className="transition-all duration-300"
                />
              </g>
            )
          })}
        </svg>

        {/* Nodes Buttons */}
        {nodes.map((node) => {
          const { x, y } = getNodeCoords(node)
          
          let nodeBg = "bg-muted text-muted-foreground border-border"
          if (node.unlocked) {
            if (node.completed) {
              nodeBg = "bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/10"
            } else {
              nodeBg = "bg-primary border-primary text-white hover:bg-primary-hover shadow-md shadow-primary/10 animate-bounce-subtle"
            }
          }

          const isPrereqCompleted = node.unlocked

          return (
            <div
              key={node.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: `${x}px`, top: `${y}px` }}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        disabled={!isPrereqCompleted}
                        onClick={() => onSelectNode(node)}
                        className={`w-14 h-14 rounded-full p-0 flex items-center justify-center border-4 transition-all duration-200 ${nodeBg} ${
                          !isPrereqCompleted && "cursor-not-allowed opacity-60"
                        }`}
                      >
                        {node.completed ? (
                          <Check className="w-6 h-6 stroke-[3px]" />
                        ) : !node.unlocked ? (
                          <Lock className="w-5 h-5" />
                        ) : node.type === "material" ? (
                          <BookOpen className="w-6 h-6" />
                        ) : (
                          <Gamepad2 className="w-6 h-6" />
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center" className="max-w-[200px] text-center">
                    <p className="font-bold text-xs">{node.name}</p>
                    {node.type === "game" && node.completed && (
                      <p className="text-[10px] text-emerald-400 mt-1 font-semibold">
                        Pontuação: {node.user_score} pts
                      </p>
                    )}
                    {node.type === "material" && node.completed && (
                      <p className="text-[10px] text-emerald-400 mt-1 font-semibold">
                        Lido (+50 pts)
                      </p>
                    )}
                    {!node.unlocked && (
                      <p className="text-[10px] text-rose-400 mt-1 font-semibold flex items-center justify-center flex-col gap-0.5">
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3 mr-1" /> Bloqueado
                        </span>
                        {node.is_released && node.released_at && new Date(node.released_at) > new Date() && (
                          <span className="text-amber-400 text-[9px]">
                            ⏰ Disponível em {new Date(node.released_at).toLocaleString("pt-BR")}
                          </span>
                        )}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )
        })}
      </div>
    </div>
  )
}

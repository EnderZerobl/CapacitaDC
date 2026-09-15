// features/nodes/types.ts — Shared Node type definitions

import type { Activity } from "@/features/activities/types"
import type { Material } from "@/features/materials/types"

export interface NodeContent {
  node: TrainingNode
  activity: Activity | null
  material: Material | null
}

export interface TrainingNode {
  id: string
  name: string
  type: "activity" | "material" | "game"
  eixo: string
  game_revision_id?: string | null
  game_format?: "quiz" | "scenario" | null
  reference_id?: string | null
  prerequisite_node_id?: string | null
  /** Corrente que vale de fato: o escolhido à mão ou a etapa anterior do eixo. */
  effective_prerequisite_id?: string | null
  activity_id?: string | null
  deadline?: string | null
  order_index?: number
  is_released: boolean
  released_at: string | null
  released_by: string | null
  unlocked: boolean
  completed: boolean
  user_score: number
  questions?: Question[]
  x_pos?: number | null
  y_pos?: number | null
}

export interface Question {
  id: string
  text: string
  explanation?: string | null
  options: Option[]
}

export interface Option {
  id: string
  text: string
  is_correct?: boolean | null
  score?: number | null
  feedback?: string | null
}

export interface NodeReleasePayload {
  is_released: boolean
  released_at: string | null
}

export interface NodeOrderPayload {
  order_index: number
}

export interface GameSubmitPayload {
  answers: GameAnswer[]
}

export interface GameAnswer {
  question_id: string
  option_id: string
}

export interface GameResult {
  detail: string
  attempt_score: number
  max_score: number
  score_added: number
  total_score: number
  user_total_points: number
  feedback: Array<GameAnswer & {
    is_correct: boolean
    score: number
    feedback?: string | null
    explanation?: string | null
  }>
}

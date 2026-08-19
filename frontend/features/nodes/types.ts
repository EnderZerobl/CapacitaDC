// features/nodes/types.ts — Shared Node type definitions

export interface TrainingNode {
  id: string
  name: string
  type: "activity" | "material" | "game"
  eixo: string
  reference_id?: string | null
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
  explanation?: string
  options: Option[]
}

export interface Option {
  id: string
  text: string
  is_correct: boolean
  score: number
  feedback?: string
}

export interface NodeReleasePayload {
  is_released: boolean
  released_at: string | null
}

export interface NodeOrderPayload {
  order_index: number
}

export interface GameSubmitPayload {
  score: number
}

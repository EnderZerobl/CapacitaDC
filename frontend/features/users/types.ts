// features/users/types.ts — Shared User type definitions

export interface Member {
  id: string
  name: string
  email: string
  eixo: string
  cargo: string
  type: string
  photo?: string
}

export interface Trainee {
  id: string
  name: string
  email: string
  photo?: string
  notaRotacao?: number
  rotacao?: number | null
  pontos_acumulados?: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  email: string
  cargo: string
  type: string
  eixo?: string
  pontos_acumulados: number
}

export interface GradeRow {
  id: string
  name: string
  email: string
  cargo: string
  type: string
  eixo?: string | null
  rotacao?: number | null
  nota_rotacao?: number | null
  pontos_acumulados: number
  nodes_completed: number
  nodes_total: number
  activities_submitted: number
  activities_graded: number
  avg_activity_grade?: number | null
}

export interface UserCreatePayload {
  name: string
  email: string
  cargo: string
  type: string
  eixo?: string
  password?: string
}

export interface UserUpdatePayload {
  name?: string
  email?: string
  cargo?: string
  type?: string
  eixo?: string
  password?: string
}

export interface TraineeUpdatePayload {
  notaRotacao?: number
  rotacao?: number
}

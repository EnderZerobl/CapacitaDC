// features/users/api.ts — All HTTP calls related to users

import { apiClient } from "@/lib/api-client"
import type {
  Member,
  Trainee,
  LeaderboardEntry,
  GradeRow,
  UserCreatePayload,
  UserUpdatePayload,
  TraineeUpdatePayload,
} from "./types"

interface RawUser {
  id: string
  name: string
  email: string
  cargo: string
  type: string
  eixo?: string
  photo?: string
  nota_rotacao?: number | null
  rotacao?: number | null
  pontos_acumulados?: number
}

function toMember(u: RawUser): Member {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    eixo: u.eixo || "",
    cargo: u.cargo,
    type: u.type,
    photo: u.photo || "",
  }
}

function toTrainee(u: RawUser): Trainee {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    photo: u.photo || "",
    notaRotacao:
      u.nota_rotacao !== null && u.nota_rotacao !== undefined
        ? u.nota_rotacao
        : undefined,
    rotacao: u.rotacao ?? null,
    pontos_acumulados: u.pontos_acumulados ?? 0,
  }
}

export const usersApi = {
  list: async (): Promise<{ members: Member[]; trainees: Trainee[] }> => {
    const raw = await apiClient.get<RawUser[]>("/api/users")
    return {
      members: raw.filter((u) => u.type !== "trainee").map(toMember),
      trainees: raw.filter((u) => u.type === "trainee").map(toTrainee),
    }
  },

  create: (payload: UserCreatePayload) =>
    apiClient.post<RawUser>("/api/users", payload),

  update: (userId: string, payload: UserUpdatePayload) =>
    apiClient.put<RawUser>(`/api/users/${userId}`, payload),

  delete: (userId: string) => apiClient.delete(`/api/users/${userId}`),

  updateTrainee: (traineeId: string, payload: TraineeUpdatePayload) =>
    apiClient.put<RawUser>(`/api/users/trainees/${traineeId}`, payload),

  getLeaderboard: () =>
    apiClient.get<LeaderboardEntry[]>("/api/leaderboard"),

  getGrades: () => apiClient.get<GradeRow[]>("/api/grades"),
}

import { apiClient } from "@/lib/api-client"
import type { AttemptPayload, Game, GameAttempt, GameDraft } from "./types"

export const gamesApi = {
  list: () => apiClient.get<Game[]>("/api/games"),
  get: (id: string) => apiClient.get<Game>(`/api/games/${id}`),
  create: (draft: GameDraft) => apiClient.post<Game>("/api/games", draft),
  update: (id: string, draft: GameDraft) => apiClient.patch<Game>(`/api/games/${id}`, draft),
  publish: (id: string) => apiClient.post<Game>(`/api/games/${id}/publish`),
  duplicate: (id: string) => apiClient.post<Game>(`/api/games/${id}/duplicate`),
  begin: (nodeId: string) => apiClient.post<GameAttempt>(`/api/nodes/${nodeId}/attempts`),
  getAttempt: (id: string) => apiClient.get<GameAttempt>(`/api/game-attempts/${id}`),
  answer: (id: string, stepId: string, optionId: string) =>
    apiClient.post<GameAttempt>(`/api/game-attempts/${id}/answers`, { step_id: stepId, option_id: optionId }),
  complete: (id: string, payload: AttemptPayload = {}) =>
    apiClient.post<GameAttempt>(`/api/game-attempts/${id}/complete`, payload),
}

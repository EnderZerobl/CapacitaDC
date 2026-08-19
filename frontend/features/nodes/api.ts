// features/nodes/api.ts — All HTTP calls related to training nodes

import { apiClient } from "@/lib/api-client"
import type {
  TrainingNode,
  NodeReleasePayload,
  NodeOrderPayload,
  GameSubmitPayload,
} from "./types"

export const nodesApi = {
  list: () => apiClient.get<TrainingNode[]>("/api/nodes"),

  create: (payload: Omit<TrainingNode, "id" | "unlocked" | "completed" | "user_score"> & {
    questions?: unknown[]
  }) => apiClient.post<TrainingNode>("/api/nodes", payload),

  delete: (nodeId: string) => apiClient.delete(`/api/nodes/${nodeId}`),

  release: (nodeId: string, payload: NodeReleasePayload) =>
    apiClient.patch<TrainingNode>(`/api/nodes/${nodeId}/release`, payload),

  updateOrder: (nodeId: string, payload: NodeOrderPayload) =>
    apiClient.patch<TrainingNode>(`/api/nodes/${nodeId}/order`, payload),

  complete: (nodeId: string) =>
    apiClient.post<{ detail: string; score_earned: number }>(
      `/api/nodes/${nodeId}/complete`
    ),

  submitGame: (nodeId: string, payload: GameSubmitPayload) =>
    apiClient.post<{
      detail: string
      score_added: number
      total_score: number
      user_total_points: number
    }>(`/api/nodes/${nodeId}/submit-game`, payload),
}

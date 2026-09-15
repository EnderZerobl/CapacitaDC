// features/nodes/api.ts — All HTTP calls related to training nodes

import { apiClient } from "@/lib/api-client"
import { mapMaterial, type RawMaterial } from "@/features/materials/api"
import type {
  NodeContent,
  TrainingNode,
  NodeReleasePayload,
  NodeOrderPayload,
  GameSubmitPayload,
  GameResult,
} from "./types"

export const nodesApi = {
  content: async (nodeId: string): Promise<NodeContent> => {
    const result = await apiClient.get<Omit<NodeContent, "material"> & { material: RawMaterial | null }>(`/api/nodes/${nodeId}/content`)
    return { ...result, material: result.material ? mapMaterial(result.material) : null }
  },

  updateActivity: (nodeId: string, activityId: string) =>
    apiClient.patch<TrainingNode>(`/api/nodes/${nodeId}/activity`, { activity_id: activityId }),

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
    apiClient.post<GameResult>(`/api/nodes/${nodeId}/submit-game`, payload),
}

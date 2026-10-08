// features/gamification/api.ts — HTTP calls for member gamification

import { apiClient } from "@/lib/api-client"
import type { GamificationSummary } from "./types"

export const gamificationApi = {
  summary: () => apiClient.get<GamificationSummary>("/api/gamification"),
}

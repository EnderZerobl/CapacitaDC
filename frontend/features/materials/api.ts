// features/materials/api.ts — All HTTP calls related to materials

import { apiClient } from "@/lib/api-client"
import type { Material, MaterialCreatePayload } from "./types"

export interface RawMaterial {
  id: string
  name: string
  type: string
  eixo: string
  text?: string
  documents: { id: string; name: string; url: string }[]
  videos: { id: string; url: string }[]
}

export function mapMaterial(raw: RawMaterial): Material {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    eixo: raw.eixo,
    text: raw.text,
    documents: raw.documents || [],
    videos: (raw.videos || []).map((v) => v.url),
  }
}

export const materialsApi = {
  list: async (): Promise<Material[]> => {
    const raw = await apiClient.get<RawMaterial[]>("/api/materials")
    return raw.map(mapMaterial)
  },

  create: async (payload: MaterialCreatePayload): Promise<Material> => {
    const raw = await apiClient.post<RawMaterial>("/api/materials", payload)
    return mapMaterial(raw)
  },

  update: async (
    materialId: string,
    payload: MaterialCreatePayload
  ): Promise<Material> => {
    const raw = await apiClient.put<RawMaterial>(
      `/api/materials/${materialId}`,
      payload
    )
    return mapMaterial(raw)
  },

  delete: (materialId: string) =>
    apiClient.delete(`/api/materials/${materialId}`),
}

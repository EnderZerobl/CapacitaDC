"use client"

// features/materials/hooks.ts — Custom hook for material state management

import { useState, useCallback, useEffect } from "react"
import { materialsApi } from "./api"
import type { Material, MaterialCreatePayload } from "./types"

export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await materialsApi.list()
      setMaterials(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar materiais")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createMaterial = async (payload: MaterialCreatePayload) => {
    const created = await materialsApi.create(payload)
    setMaterials((prev) => [...prev, created])
    return created
  }

  const updateMaterial = async (
    materialId: string,
    payload: MaterialCreatePayload
  ) => {
    const updated = await materialsApi.update(materialId, payload)
    setMaterials((prev) =>
      prev.map((m) => (m.id === materialId ? updated : m))
    )
    return updated
  }

  const deleteMaterial = async (materialId: string) => {
    await materialsApi.delete(materialId)
    setMaterials((prev) => prev.filter((m) => m.id !== materialId))
  }

  return {
    materials,
    loading,
    error,
    refresh,
    createMaterial,
    updateMaterial,
    deleteMaterial,
  }
}

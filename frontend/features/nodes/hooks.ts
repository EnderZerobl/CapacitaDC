"use client"

// features/nodes/hooks.ts — Custom hooks for training node state management

import { useState, useCallback, useEffect } from "react"
import { nodesApi } from "./api"
import type { TrainingNode, NodeReleasePayload, NodeOrderPayload } from "./types"

/** Converts a UTC ISO string to the local "YYYY-MM-DDTHH:mm" format */
export function utcToLocalInput(utcIso: string): string {
  const d = new Date(utcIso)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function useNodes() {
  const [nodes, setNodes] = useState<TrainingNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Per-node local release state: nodeId → { isReleased, scheduledDate }
  const [nodeReleaseState, setNodeReleaseState] = useState<
    Record<string, { isReleased: boolean; scheduledDate: string }>
  >({})

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await nodesApi.list()
      setNodes(data)
      const initial: Record<string, { isReleased: boolean; scheduledDate: string }> = {}
      data.forEach((n) => {
        initial[n.id] = {
          isReleased: n.is_released,
          scheduledDate: n.released_at ? utcToLocalInput(n.released_at) : "",
        }
      })
      setNodeReleaseState(initial)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar nós")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateReleaseLocal = (
    nodeId: string,
    patch: Partial<{ isReleased: boolean; scheduledDate: string }>
  ) => {
    setNodeReleaseState((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], ...patch },
    }))
  }

  const saveNodeRelease = async (nodeId: string) => {
    const state = nodeReleaseState[nodeId]
    if (!state) return
    const payload: NodeReleasePayload = {
      is_released: state.isReleased,
      released_at:
        state.isReleased && state.scheduledDate
          ? new Date(state.scheduledDate).toISOString()
          : null,
    }
    const updated = await nodesApi.release(nodeId, payload)
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...updated } : n)))
    setNodeReleaseState((prev) => ({
      ...prev,
      [nodeId]: {
        isReleased: updated.is_released,
        scheduledDate: updated.released_at ? utcToLocalInput(updated.released_at) : "",
      },
    }))
  }

  const moveNode = async (nodeId: string, direction: "up" | "down", eixo: string) => {
    const eixoNodes = nodes
      .filter((n) => n.eixo === eixo)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const index = eixoNodes.findIndex((n) => n.id === nodeId)
    if (index === -1) return
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= eixoNodes.length) return

    const currentNode = eixoNodes[index]
    const targetNode = eixoNodes[targetIndex]
    let newCurIdx = targetNode.order_index ?? 0
    let newTarIdx = currentNode.order_index ?? 0
    if (newCurIdx === newTarIdx) {
      newCurIdx = direction === "up" ? (currentNode.order_index ?? 0) - 1 : (currentNode.order_index ?? 0) + 1
      newTarIdx = currentNode.order_index ?? 0
    }

    await Promise.all([
      nodesApi.updateOrder(currentNode.id, { order_index: newCurIdx }),
      nodesApi.updateOrder(targetNode.id, { order_index: newTarIdx }),
    ])
    await refresh()
  }

  const deleteNode = async (nodeId: string) => {
    await nodesApi.delete(nodeId)
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
  }

  const completeNode = async (nodeId: string) => {
    const result = await nodesApi.complete(nodeId)
    await refresh()
    return result
  }

  const submitGame = async (nodeId: string, score: number) => {
    const result = await nodesApi.submitGame(nodeId, { score })
    await refresh()
    return result
  }

  return {
    nodes,
    loading,
    error,
    refresh,
    nodeReleaseState,
    setNodeReleaseState,
    updateReleaseLocal,
    saveNodeRelease,
    moveNode,
    deleteNode,
    completeNode,
    submitGame,
  }
}

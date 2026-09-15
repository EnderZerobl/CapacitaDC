"use client"

// features/nodes/hooks.ts — Custom hooks for training node state management

import { useState, useCallback, useEffect } from "react"
import { nodesApi } from "./api"
import type { TrainingNode, NodeReleasePayload, GameAnswer } from "./types"

/** Converts a UTC ISO string (possibly naive, without 'Z') to local "YYYY-MM-DDTHH:mm" format */
export function utcToLocalInput(utcIso: string): string {
  // Backend returns naive datetimes (no timezone indicator) that are actually UTC.
  // Append 'Z' if missing so the browser interprets the string as UTC, not local.
  const hasTimezone = utcIso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(utcIso)
  const d = new Date(hasTimezone ? utcIso : utcIso + 'Z')
  // Use local Date getters — they automatically convert to the user's timezone
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
      setError(null)
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

  // Auto-refresh: poll when there are scheduled nodes with future released_at
  useEffect(() => {
    if (nodes.length === 0) return

    // Find all nodes with a future scheduled release
    const now = Date.now()
    const scheduledNodes = nodes.filter((n) => {
      if (!n.is_released || !n.released_at) return false
      const hasTimezone = n.released_at.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(n.released_at)
      const releaseMs = new Date(hasTimezone ? n.released_at : n.released_at + 'Z').getTime()
      return releaseMs > now
    })

    if (scheduledNodes.length === 0) return

    // Find the nearest upcoming release
    const nextReleaseMs = Math.min(
      ...scheduledNodes.map((n) => {
        const hasTimezone = n.released_at!.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(n.released_at!)
        return new Date(hasTimezone ? n.released_at! : n.released_at! + 'Z').getTime()
      })
    )

    // Schedule refresh at that exact moment (+ small buffer), capped at 60s interval
    const msUntilRelease = nextReleaseMs - Date.now()
    const delay = Math.min(Math.max(msUntilRelease + 1000, 1000), 60_000)

    const timer = setTimeout(() => {
      refresh()
    }, delay)

    return () => clearTimeout(timer)
  }, [nodes, refresh])

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

  const submitGame = async (nodeId: string, answers: GameAnswer[]) => {
    const result = await nodesApi.submitGame(nodeId, { answers })
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

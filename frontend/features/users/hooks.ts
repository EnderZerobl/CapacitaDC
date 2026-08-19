"use client"

// features/users/hooks.ts — Custom hooks for user/member/trainee state management

import { useState, useCallback, useEffect } from "react"
import { usersApi } from "./api"
import type {
  Member,
  Trainee,
  GradeRow,
  UserCreatePayload,
  UserUpdatePayload,
  TraineeUpdatePayload,
} from "./types"

export function useUsers() {
  const [members, setMembers] = useState<Member[]>([])
  const [trainees, setTrainees] = useState<Trainee[]>([])
  const [grades, setGrades] = useState<GradeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const [{ members: m, trainees: t }, g] = await Promise.all([
        usersApi.list(),
        usersApi.getGrades(),
      ])
      setMembers(m)
      setTrainees(t)
      setGrades(g)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar usuários")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createUser = async (payload: UserCreatePayload) => {
    const raw = await usersApi.create(payload)
    await refresh()
    return raw
  }

  const updateUser = async (userId: string, payload: UserUpdatePayload) => {
    await usersApi.update(userId, payload)
    await refresh()
  }

  const deleteUser = async (userId: string) => {
    await usersApi.delete(userId)
    await refresh()
  }

  const updateTrainee = async (
    traineeId: string,
    payload: TraineeUpdatePayload
  ) => {
    await usersApi.updateTrainee(traineeId, payload)
    await refresh()
  }

  return {
    members,
    trainees,
    grades,
    loading,
    error,
    refresh,
    createUser,
    updateUser,
    deleteUser,
    updateTrainee,
  }
}

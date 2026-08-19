"use client"

// features/activities/hooks.ts — Custom hooks for activity state management

import { useState, useCallback, useEffect } from "react"
import { activitiesApi } from "./api"
import type {
  Activity,
  ActivityCreatePayload,
  ActivityUpdatePayload,
  ActivitySubmissionOut,
} from "./types"

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activitySubmissions, setActivitySubmissions] = useState<
    Record<string, ActivitySubmissionOut[]>
  >({})
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await activitiesApi.list()
      setActivities(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar atividades")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createActivity = async (payload: ActivityCreatePayload) => {
    const created = await activitiesApi.create(payload)
    setActivities((prev) => [created, ...prev])
    return created
  }

  const updateActivity = async (
    activityId: string,
    payload: ActivityUpdatePayload
  ) => {
    const updated = await activitiesApi.update(activityId, payload)
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? updated : a))
    )
    return updated
  }

  const deleteActivity = async (activityId: string) => {
    await activitiesApi.delete(activityId)
    setActivities((prev) => prev.filter((a) => a.id !== activityId))
  }

  const toggleActivity = async (activityId: string, currentOpen: boolean) => {
    return updateActivity(activityId, { is_open: !currentOpen })
  }

  const loadSubmissions = async (activityId: string) => {
    if (expandedActivity === activityId) {
      setExpandedActivity(null)
      return
    }
    const subs = await activitiesApi.getSubmissions(activityId)
    setActivitySubmissions((prev) => ({ ...prev, [activityId]: subs }))
    setExpandedActivity(activityId)
  }

  const submitActivity = async (
    activityId: string,
    fileUrl: string | null,
    comment: string
  ) => {
    const result = await activitiesApi.submit(activityId, {
      file_url: fileUrl || null,
      comment: comment || "",
    })
    await refresh()
    return result
  }

  const gradeSubmission = async (
    activityId: string,
    submissionId: string,
    grade: number,
    feedback: string
  ) => {
    const updated = await activitiesApi.gradeSubmission(activityId, submissionId, {
      grade,
      feedback,
    })
    setActivitySubmissions((prev) => ({
      ...prev,
      [activityId]: (prev[activityId] || []).map((s) =>
        s.id === submissionId ? updated : s
      ),
    }))
    return updated
  }

  return {
    activities,
    loading,
    error,
    refresh,
    activitySubmissions,
    expandedActivity,
    createActivity,
    updateActivity,
    deleteActivity,
    toggleActivity,
    loadSubmissions,
    submitActivity,
    gradeSubmission,
  }
}

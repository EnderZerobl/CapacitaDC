// features/activities/api.ts — All HTTP calls related to activities

import { apiClient } from "@/lib/api-client"
import type {
  Activity,
  ActivityCreatePayload,
  ActivityUpdatePayload,
  SubmissionCreatePayload,
  SubmissionGradePayload,
  ActivitySubmissionOut,
} from "./types"

export const activitiesApi = {
  list: () => apiClient.get<Activity[]>("/api/activities"),

  create: (payload: ActivityCreatePayload) =>
    apiClient.post<Activity>("/api/activities", payload),

  update: (activityId: string, payload: ActivityUpdatePayload) =>
    apiClient.patch<Activity>(`/api/activities/${activityId}`, payload),

  delete: (activityId: string) =>
    apiClient.delete(`/api/activities/${activityId}`),

  getSubmissions: (activityId: string) =>
    apiClient.get<ActivitySubmissionOut[]>(
      `/api/activities/${activityId}/submissions`
    ),

  submit: (activityId: string, payload: SubmissionCreatePayload) =>
    apiClient.post<ActivitySubmissionOut>(
      `/api/activities/${activityId}/submit`,
      payload
    ),

  gradeSubmission: (
    activityId: string,
    submissionId: string,
    payload: SubmissionGradePayload
  ) =>
    apiClient.patch<ActivitySubmissionOut>(
      `/api/activities/${activityId}/submissions/${submissionId}`,
      payload
    ),
}

// features/activities/types.ts — Shared Activity type definitions

export interface SubmissionAttachment {
  id: string
  name: string
  size: number
  url: string
}

export interface ActivitySubmission {
  attachments?: SubmissionAttachment[]
  links?: string[]
  id: string
  file_url?: string | null
  comment?: string
  submitted_at?: string | null
  grade?: number | null
  feedback?: string
}

export interface Activity {
  id: string
  title: string
  description?: string
  eixo: string
  material_id?: string | null
  accepts_file: boolean
  deadline?: string | null
  is_open: boolean
  effective_open: boolean
  submission_count: number
  weight?: number
  created_by?: string | null
  created_at?: string | null
  my_submission?: ActivitySubmission | null
}

export interface ActivityCreatePayload {
  title: string
  description?: string
  eixo: string
  accepts_file: boolean
  deadline?: string | null
  material_id?: string | null
  weight?: number
}

export interface ActivityUpdatePayload {
  is_open?: boolean
  deadline?: string | null
  title?: string
  description?: string
  accepts_file?: boolean
  material_id?: string | null
  weight?: number
}

export interface SubmissionCreatePayload {
  attachment_ids?: string[]
  links?: string[]
  file_url?: string | null
  comment?: string
  node_id?: string | null
}

export interface SubmissionGradePayload {
  grade: number
  feedback?: string
}

export interface ActivitySubmissionOut {
  attachments?: SubmissionAttachment[]
  links?: string[]
  id: string
  activity_id: string
  user_id: string
  file_url?: string | null
  comment?: string
  submitted_at?: string | null
  grade?: number | null
  feedback?: string
  user_name?: string | null
  user_type?: string | null
  activity_title?: string | null
  activity_weight?: number | null
  activity_eixo?: string | null
}

export interface SubmissionQueueFilters {
  status?: "pending" | "graded" | "all"
  user_type?: "trainee" | "membro" | "all"
  eixo?: string
  activity_id?: string
  user_id?: string
  limit?: number
  offset?: number
}

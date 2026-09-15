export type GameFormat = "quiz" | "scenario" | "matching" | "ordering" | "categorization"

export interface QuizOption {
  id: string
  text: string
  is_correct: boolean
  feedback: string
}

export interface QuizQuestion {
  id: string
  text: string
  selection: "single" | "multiple"
  weight: number
  explanation: string
  options: QuizOption[]
}

export interface QuizConfig {
  questions: QuizQuestion[]
}

export interface ScenarioOption {
  id: string
  text: string
  score: number
  feedback: string
  next_step_id: string | null
}

export interface ScenarioStep {
  id: string
  text: string
  options: ScenarioOption[]
}

export interface ScenarioConfig {
  start_step_id: string
  steps: ScenarioStep[]
}

export interface MatchingCard {
  id: string
  /** Identifies the matching card itself, so the board never reveals the pair. */
  right_id: string
  left: string
  right: string
  feedback: string
}

export interface MatchingDistractor {
  id: string
  right: string
}

export interface MatchingConfig {
  pairs: MatchingCard[]
  distractors: MatchingDistractor[]
}

export interface OrderingItem {
  id: string
  text: string
}

export interface OrderingConfig {
  items: OrderingItem[]
  explanation: string
}

export interface Category {
  id: string
  text: string
  description: string
}

export interface CategorizedItem {
  id: string
  text: string
  category_id: string
  feedback: string
}

export interface CategorizationConfig {
  categories: Category[]
  items: CategorizedItem[]
}

export type GameContent =
  | { format: "quiz"; config: QuizConfig }
  | { format: "scenario"; config: ScenarioConfig }
  | { format: "matching"; config: MatchingConfig }
  | { format: "ordering"; config: OrderingConfig }
  | { format: "categorization"; config: CategorizationConfig }

export type GameDraft = GameContent & {
  title: string
  instructions: string
  eixo: string
}

export type GameRevision = GameContent & {
  id: string
  game_id: string
  version: number
  title: string
  instructions: string
  max_points: number
  published_at: string
}

export type Game = GameDraft & {
  id: string
  published_revision: GameRevision | null
  has_unpublished_changes: boolean
  created_at: string
  updated_at: string
}

export interface PublicQuestion {
  id: string
  text: string
  selection: "single" | "multiple"
  options: { id: string; text: string }[]
}

export interface PublicStep {
  id: string
  text: string
  options: { id: string; text: string }[]
}

export interface BoardCard {
  id: string
  text: string
}

export interface GameBoard {
  left?: BoardCard[]
  right?: BoardCard[]
  items?: BoardCard[]
  categories?: (BoardCard & { description: string })[]
}

export interface QuizAnswer {
  question_id: string
  option_ids: string[]
}

export interface MatchAnswer {
  left_id: string
  right_id: string
}

export interface PlacementAnswer {
  item_id: string
  category_id: string
}

// One list per format; the API refuses lists belonging to another format.
export interface AttemptPayload {
  answers?: QuizAnswer[]
  matches?: MatchAnswer[]
  order?: string[]
  placements?: PlacementAnswer[]
}

export interface ScenarioAnswer {
  step_id: string
  option_id: string
}

export interface GameResult {
  attempt_score: number
  max_score: number
  score_added: number
  total_score: number
  user_total_points: number
  note: string
  feedback: {
    question_id?: string
    step_id?: string
    item_id?: string
    text: string
    option_ids: string[]
    is_correct?: boolean
    score: number
    max_score: number
    explanation: string
    feedback: string
  }[]
}

export interface GameAttempt {
  id: string
  node_id: string
  game_revision_id: string
  status: "in_progress" | "completed"
  format: GameFormat
  title: string
  instructions: string
  max_score: number
  questions?: PublicQuestion[]
  current_step: PublicStep | null
  board: GameBoard | null
  answers: (QuizAnswer | ScenarioAnswer | MatchAnswer | PlacementAnswer | string)[]
  can_finish: boolean
  result: GameResult | null
}

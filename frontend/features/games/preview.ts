import type { AttemptDraft } from "./attempt-draft"
import type { GameBoard, GameDraft, GameResult, ScenarioConfig } from "./types"

/** Local preview scoring that mirrors the API rules; it never records progress. */
type Feedback = GameResult["feedback"]

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function previewBoard(draft: GameDraft): GameBoard | null {
  if (draft.format === "matching") {
    return {
      left: draft.config.pairs.map(pair => ({ id: pair.id, text: pair.left })),
      right: shuffle([...draft.config.pairs.map(pair => ({ id: pair.right_id, text: pair.right })),
                      ...draft.config.distractors.map(card => ({ id: card.id, text: card.right }))]),
    }
  }
  if (draft.format === "ordering") return { items: shuffle(draft.config.items.map(item => ({ id: item.id, text: item.text }))) }
  if (draft.format === "categorization") {
    return {
      categories: draft.config.categories.map(category => ({ id: category.id, text: category.text, description: category.description })),
      items: shuffle(draft.config.items.map(item => ({ id: item.id, text: item.text }))),
    }
  }
  return null
}

function result(feedback: Feedback, score: number, maximum: number, note = ""): GameResult {
  return {
    attempt_score: maximum ? Math.round(score * 100 / maximum) : 0, max_score: 100,
    score_added: 0, total_score: 0, user_total_points: 0, note, feedback,
  }
}

export function previewResult(draft: GameDraft, state: AttemptDraft): GameResult {
  if (draft.format === "quiz") {
    const feedback: Feedback = draft.config.questions.map(question => {
      const selected = state.answers[question.id] || []
      const correct = question.options.filter(option => option.is_correct).map(option => option.id)
      const is_correct = selected.length === correct.length && selected.every(id => correct.includes(id))
      return {
        question_id: question.id, text: question.text, option_ids: selected, is_correct,
        score: is_correct ? question.weight : 0, max_score: question.weight, explanation: question.explanation,
        feedback: question.options.filter(option => selected.includes(option.id)).map(option => option.feedback).filter(Boolean).join("\n"),
      }
    })
    return result(feedback, sum(feedback), feedback.reduce((total, item) => total + item.max_score, 0))
  }
  if (draft.format === "matching") {
    const feedback: Feedback = draft.config.pairs.map(pair => {
      const chosen = state.selection[pair.id] || ""
      const is_correct = chosen === pair.right_id
      return {
        item_id: pair.id, text: pair.left, option_ids: [chosen], is_correct, score: is_correct ? 1 : 0,
        max_score: 1, explanation: is_correct ? "" : `Correspondência correta: ${pair.right}`, feedback: pair.feedback,
      }
    })
    return result(feedback, sum(feedback), feedback.length)
  }
  if (draft.format === "ordering") {
    const expected = draft.config.items.map(item => item.id)
    const feedback: Feedback = state.order.map((id, position) => {
      const item = draft.config.items.find(entry => entry.id === id)
      const is_correct = expected[position] === id
      return {
        item_id: id, text: item?.text || "", option_ids: [id], is_correct, score: is_correct ? 1 : 0,
        max_score: 1, explanation: is_correct ? "" : `Posição correta: ${expected.indexOf(id) + 1}ª`, feedback: "",
      }
    })
    return result(feedback, sum(feedback), expected.length, draft.config.explanation)
  }
  if (draft.format === "categorization") {
    const feedback: Feedback = draft.config.items.map(item => {
      const chosen = state.selection[item.id] || ""
      const is_correct = chosen === item.category_id
      const category = draft.config.categories.find(entry => entry.id === item.category_id)
      return {
        item_id: item.id, text: item.text, option_ids: [chosen], is_correct, score: is_correct ? 1 : 0,
        max_score: 1, explanation: is_correct ? "" : `Categoria correta: ${category?.text || ""}`, feedback: item.feedback,
      }
    })
    return result(feedback, sum(feedback), feedback.length)
  }
  return result([], 0, 0)
}

export function scenarioPreviewResult(config: ScenarioConfig, path: { stepId: string; optionId: string }[]): GameResult {
  const feedback: Feedback = path.map(answer => {
    const step = config.steps.find(item => item.id === answer.stepId)!
    const selected = step.options.find(item => item.id === answer.optionId)!
    return {
      step_id: step.id, text: step.text, option_ids: [selected.id], score: selected.score,
      max_score: Math.max(...step.options.map(item => item.score)), explanation: "", feedback: selected.feedback,
    }
  })
  const best = new Map<string, number>()
  const bestFrom = (id: string | null): number => {
    if (!id) return 0
    if (!best.has(id)) {
      const step = config.steps.find(item => item.id === id)!
      best.set(id, Math.max(...step.options.map(option => option.score + bestFrom(option.next_step_id))))
    }
    return best.get(id)!
  }
  return result(feedback, sum(feedback), bestFrom(config.start_step_id))
}

function sum(feedback: Feedback): number {
  return feedback.reduce((total, item) => total + item.score, 0)
}

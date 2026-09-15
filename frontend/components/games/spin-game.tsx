"use client"

import { useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Star } from "lucide-react"
import type { GameAnswer, GameResult, Question } from "@/features/nodes/types"

interface SpinGameProps {
  nodeName: string
  questions?: Question[]
  onComplete: (answers: GameAnswer[]) => Promise<GameResult>
  onClose: () => void
}

export function SpinGame({ nodeName, questions = [], onComplete, onClose }: SpinGameProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<GameResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submissionPending = useRef(false)
  const currentQuestion = questions[currentIndex]

  const handleSubmit = async () => {
    if (submissionPending.current || questions.some(question => !answers[question.id])) return
    submissionPending.current = true
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await onComplete(questions.map(question => ({
        question_id: question.id,
        option_id: answers[question.id],
      })))
      setResult(response)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar as respostas. Tente novamente.")
    } finally {
      submissionPending.current = false
      setIsSubmitting(false)
    }
  }

  if (!currentQuestion) {
    return (
      <Card>
        <CardHeader><CardTitle>{nodeName}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Este jogo ainda não possui perguntas disponíveis.</p>
          <Button variant="outline" onClick={onClose}>Voltar à trilha</Button>
        </CardContent>
      </Card>
    )
  }

  if (result) {
    const scorePercentage = result.max_score > 0 ? result.attempt_score / result.max_score * 100 : 0
    return (
      <Card className="w-full max-w-xl mx-auto border-primary/20">
        <CardHeader className="text-center">
          <Star className="w-12 h-12 mx-auto text-yellow-500" />
          <CardTitle>Jogo concluído!</CardTitle>
          <p className="text-sm text-muted-foreground">{nodeName}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Pontuação desta tentativa</p>
            <p className="text-4xl font-bold text-primary mt-2">
              {result.attempt_score} <span className="text-lg text-muted-foreground">/ {result.max_score} pts</span>
            </p>
            <Badge variant={scorePercentage >= 70 ? "default" : "secondary"} className="mt-3">
              {scorePercentage >= 90 ? "Ótimo desempenho!" : scorePercentage >= 70 ? "Bom desempenho!" : "Continue praticando!"}
            </Badge>
            <p className="text-sm text-muted-foreground mt-3">
              {result.score_added > 0 ? `${result.score_added} pontos adicionados ao seu total.` : "Seu progresso foi registrado. Esta tentativa não acrescentou pontos ao seu total."}
            </p>
          </div>
          <div className="space-y-3">
            {result.feedback.map((item, index) => {
              const question = questions.find(question => question.id === item.question_id)
              const option = question?.options.find(option => option.id === item.option_id)
              return (
                <div key={item.question_id} className="rounded-xl border border-border bg-muted/50 p-4 space-y-2 text-sm">
                  <p className="font-semibold">{index + 1}. {question?.text}</p>
                  <p className="text-muted-foreground">Sua resposta: {option?.text}</p>
                  <p className="flex items-center gap-2 font-medium">
                    {item.is_correct ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                    {item.is_correct ? "Resposta correta" : "Revise esta resposta"} · {item.score} pts
                  </p>
                  {item.feedback && <p>{item.feedback}</p>}
                  {item.explanation && item.explanation !== item.feedback && <p className="text-muted-foreground">{item.explanation}</p>}
                </div>
              )
            })}
          </div>
          <Button className="w-full" onClick={onClose}>Voltar à trilha</Button>
        </CardContent>
      </Card>
    )
  }

  const selectedOptionId = answers[currentQuestion.id]
  return (
    <Card className="w-full max-w-xl mx-auto border-primary/20">
      <CardHeader className="space-y-4">
        <CardTitle>{nodeName}</CardTitle>
        <Badge variant="outline" className="w-fit">Pergunta {currentIndex + 1} de {questions.length}</Badge>
        <Progress value={Object.keys(answers).length / questions.length * 100} aria-label="Perguntas respondidas" />
      </CardHeader>
      <CardContent className="space-y-6">
        <p id="game-question" className="font-semibold whitespace-pre-line">{currentQuestion.text}</p>
        <div role="group" aria-labelledby="game-question" className="space-y-3">
          {currentQuestion.options.map(option => (
            <Button
              key={option.id}
              variant={selectedOptionId === option.id ? "default" : "outline"}
              aria-pressed={selectedOptionId === option.id}
              disabled={isSubmitting}
              onClick={() => setAnswers(previous => ({ ...previous, [currentQuestion.id]: option.id }))}
              className="w-full h-auto justify-start whitespace-normal text-left py-4"
            >
              {option.text}
            </Button>
          ))}
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex justify-between gap-3">
          <Button variant="outline" disabled={isSubmitting || currentIndex === 0} onClick={() => setCurrentIndex(index => index - 1)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          {currentIndex < questions.length - 1 ? (
            <Button disabled={!selectedOptionId} onClick={() => setCurrentIndex(index => index + 1)}>
              Próxima <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={isSubmitting || questions.some(question => !answers[question.id])} onClick={handleSubmit}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Enviando..." : "Concluir e ver resultado"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

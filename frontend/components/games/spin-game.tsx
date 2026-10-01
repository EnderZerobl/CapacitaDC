"use client"

import { useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react"
import type { GameAnswer, GameResult, Question } from "@/features/nodes/types"

interface SpinGameProps {
  nodeName: string
  allowRetry?: boolean
  questions?: Question[]
  onComplete: (answers: GameAnswer[]) => Promise<GameResult>
  onClose: () => void
}

export function SpinGame({ nodeName, allowRetry = true, questions = [], onComplete, onClose }: SpinGameProps) {
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
    return (
      <Card className="w-full border-primary/20">
        <CardHeader className="text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
          <CardTitle>Jogo concluído!</CardTitle>
          <p className="text-sm text-muted-foreground">{nodeName}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-sm text-muted-foreground">Seu progresso foi registrado.</p>
          {result.grade != null && <p className="text-center text-lg font-semibold">Nota desta tentativa: {result.grade.toFixed(2)} / 10</p>}
          {result.best_grade != null && <p className="text-center text-sm text-muted-foreground">Melhor nota: {result.best_grade.toFixed(2)} / 10</p>}
          <div className="space-y-3">
            {result.feedback.map((item, index) => {
              const question = questions.find(question => question.id === item.question_id)
              const option = question?.options.find(option => option.id === item.option_id)
              return (
                <div key={item.question_id} className="rounded-xl border border-border bg-muted/50 p-4 space-y-2 text-sm">
                  <p className="font-semibold">{index + 1}. {question?.text}</p>
                  <p className="text-muted-foreground">Sua resposta: {option?.text}</p>
                  <p className="flex items-center gap-2 font-medium">
                    {item.is_correct ? <CheckCircle2 className="h-4 w-4 text-emerald-500 light:text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-500 light:text-amber-600" />}
                    {item.is_correct ? "Resposta correta" : "Revise esta resposta"}
                  </p>
                  {item.feedback && <p>{item.feedback}</p>}
                  {item.explanation && item.explanation !== item.feedback && <p className="text-muted-foreground">{item.explanation}</p>}
                </div>
              )
            })}
          </div>
          {allowRetry ? <Button variant="outline" className="w-full" onClick={() => { setResult(null); setAnswers({}); setCurrentIndex(0) }}>Repetir jogo</Button> : <p className="text-sm text-muted-foreground">A repetição deste jogo não está permitida.</p>}
          <Button className="w-full" onClick={onClose}>Voltar à trilha</Button>
        </CardContent>
      </Card>
    )
  }

  const selectedOptionId = answers[currentQuestion.id]
  return (
    <Card className="w-full border-primary/20">
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

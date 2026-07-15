"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, AlertCircle, ArrowRight, Star, MessageSquare } from "lucide-react"

interface Option {
  id: string
  text: string
  is_correct: boolean
  score: number
  feedback?: string
}

interface Question {
  id: string
  text: string
  explanation?: string
  options: Option[]
}

interface SpinGameProps {
  nodeName: string
  questions: Question[]
  onComplete: (score: number) => void
  onClose: () => void
}

export function SpinGame({ nodeName, questions, onComplete, onClose }: SpinGameProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<Option | null>(null)
  const [totalScore, setTotalScore] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  const currentQuestion = questions[currentIndex]
  const progressPercent = (currentIndex / questions.length) * 100

  const handleOptionSelect = (option: Option) => {
    if (selectedOption) return // prevent double clicking/multiple selections
    setSelectedOption(option)
    setTotalScore((prev) => prev + option.score)
  }

  const handleNext = () => {
    setSelectedOption(null)
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setIsFinished(true)
    }
  }

  if (isFinished) {
    const maxPossibleScore = questions.length * 100
    const scorePercentage = (totalScore / maxPossibleScore) * 100

    return (
      <Card className="w-full max-w-xl mx-auto border-2 border-primary/20 shadow-2xl bg-card overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 p-6 text-center border-b border-border">
          <Star className="w-16 h-16 mx-auto text-yellow-500 animate-bounce mb-2" />
          <CardTitle className="text-2xl font-bold">Jogo Concluído!</CardTitle>
          <p className="text-muted-foreground mt-1">{nodeName}</p>
        </div>
        <CardContent className="p-6 flex flex-col items-center space-y-6">
          <div className="text-center">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Sua Pontuação</span>
            <div className="text-5xl font-extrabold text-primary mt-2">
              {totalScore} <span className="text-xl text-muted-foreground font-normal">/ {maxPossibleScore} pts</span>
            </div>
            <Badge variant={scorePercentage >= 70 ? "default" : "secondary"} className="mt-2 text-sm px-3 py-1">
              {scorePercentage >= 90
                ? "🏆 Mestre das Vendas!"
                : scorePercentage >= 70
                ? "👏 Excelente Desempenho!"
                : "📚 Continue Praticando!"}
            </Badge>
          </div>

          <div className="w-full bg-muted p-4 rounded-xl text-sm text-center">
            Pratique mais para consolidar as etapas do <strong>SPIN Selling</strong> e obter a pontuação máxima no ranking cumulativo!
          </div>

          <div className="flex w-full space-x-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Voltar à Trilha
            </Button>
            <Button className="flex-1" onClick={() => onComplete(totalScore)}>
              Registrar Pontos
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-xl mx-auto border-2 border-primary/20 shadow-2xl bg-card overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-gradient-to-b from-muted/50 to-card p-6 border-b border-border">
        <div className="flex justify-between items-center mb-2">
          <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
            Pergunta {currentIndex + 1} de {questions.length}
          </Badge>
          <span className="text-xs font-bold text-muted-foreground">Pontos: {totalScore}</span>
        </div>
        <Progress value={progressPercent} className="h-2 rounded-full" />
      </CardHeader>

      {/* Main Content */}
      <CardContent className="p-6 space-y-6">
        {/* Chat Customer Node */}
        <div className="flex items-start space-x-3">
          <div className="bg-primary/10 text-primary p-2.5 rounded-xl border border-primary/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="bg-muted p-4 rounded-2xl rounded-tl-none border border-border text-sm flex-1">
            <p className="font-semibold text-xs text-primary mb-1">Cliente / Prospect</p>
            <p className="text-foreground leading-relaxed font-medium">{currentQuestion.text}</p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedOption?.id === option.id
            const isChoiceCorrect = option.is_correct
            const isAnySelected = selectedOption !== null

            let btnVariant: "outline" | "default" | "destructive" = "outline"
            if (isSelected) {
              btnVariant = isChoiceCorrect ? "default" : "destructive"
            }

            return (
              <Button
                key={option.id}
                variant={btnVariant}
                disabled={isAnySelected}
                onClick={() => handleOptionSelect(option)}
                className={`w-full justify-start text-left py-4 px-4 h-auto text-sm leading-relaxed border transition-all duration-200 hover:scale-[1.01] ${
                  isAnySelected && !isSelected && "opacity-60"
                } ${isSelected && isChoiceCorrect && "bg-emerald-600 hover:bg-emerald-600 border-emerald-500 text-white"} ${
                  isSelected && !isChoiceCorrect && "bg-rose-600 hover:bg-rose-600 border-rose-500 text-white"
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span>{option.text}</span>
                  {isSelected && (isChoiceCorrect ? <CheckCircle2 className="w-5 h-5 ml-2" /> : <AlertCircle className="w-5 h-5 ml-2" />)}
                </div>
              </Button>
            )
          })}
        </div>

        {/* Feedback box */}
        {selectedOption && (
          <div
            className={`p-4 rounded-xl border animate-in slide-in-from-bottom duration-300 text-sm ${
              selectedOption.is_correct
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300"
            }`}
          >
            <div className="flex items-center space-x-2 font-bold mb-1">
              {selectedOption.is_correct ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Muito bom! (+{selectedOption.score} pts)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  <span>Eficácia Parcial (+{selectedOption.score} pts)</span>
                </>
              )}
            </div>
            <p className="leading-relaxed text-xs">{selectedOption.feedback || currentQuestion.explanation}</p>

            <div className="flex justify-end mt-4">
              <Button size="sm" onClick={handleNext} className="bg-primary hover:bg-primary/90 text-white">
                Avançar <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

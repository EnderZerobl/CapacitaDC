"use client"

import { MemberCard } from "./member-card"
import { TraineeCard, TraineeActivity } from "./trainee-card"
import { TraineeEditForm } from "./trainee-edit-form"

interface Member {
  id: string
  name: string
  eixo: string
  cargo: string
  photo?: string
}

interface Trainee {
  id: string
  name: string
  photo?: string
  notaRotacao?: number
  atividades?: TraineeActivity[]
}

interface UsersSectionProps {
  members: Member[]
  trainees: Trainee[]
  onUpdateTrainee?: (
    traineeId: string,
    data: { notaRotacao?: number; atividades: TraineeActivity[] }
  ) => void
}

export function UsersSection({ members, trainees, onUpdateTrainee }: UsersSectionProps) {
  return (
    <div className="space-y-8">
      {/* Membros */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            Membros de Comercial
          </h2>
          <span className="text-sm text-muted-foreground">
            {members.length} membro(s)
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              name={member.name}
              eixo={member.eixo}
              cargo={member.cargo}
              photo={member.photo}
            />
          ))}
        </div>
      </div>

      {/* Trainees */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            Trainees de Comercial
          </h2>
          <span className="text-sm text-muted-foreground">
            {trainees.length} trainee(s)
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trainees.map((trainee) => (
            <div key={trainee.id} className="relative group">
              <TraineeCard
                name={trainee.name}
                photo={trainee.photo}
                notaRotacao={trainee.notaRotacao}
                atividades={trainee.atividades}
              />
              {onUpdateTrainee && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <TraineeEditForm
                    traineeId={trainee.id}
                    traineeName={trainee.name}
                    notaRotacao={trainee.notaRotacao}
                    atividades={trainee.atividades || []}
                    onSave={(data) => onUpdateTrainee(trainee.id, data)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

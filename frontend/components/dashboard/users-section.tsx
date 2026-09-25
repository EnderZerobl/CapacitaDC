"use client"

import { MemberCard } from "./member-card"
import { TraineeCard } from "./trainee-card"
import { UserEditModal } from "./user-edit-modal"


interface Member {
  id: string
  name: string
  email: string
  eixo: string
  cargo: string
  type: string
  photo?: string
}

interface Trainee {
  id: string
  name: string
  email: string
  photo?: string
  notaRotacao?: number
  rotacao?: number | null
}

interface UsersSectionProps {
  members: Member[]
  trainees: Trainee[]
  showGrades?: boolean    // admin/org only
  showProfiles?: boolean  // admin/org only
  membersTitle?: string
  currentUserRole?: string
  onUpdateTrainee?: (traineeId: string, data: { rotacao?: number }) => void
  onUpdateUser?: (
    userId: string,
    data: { name: string; email: string; cargo?: string; type: string; eixo?: string; password?: string; rotacao?: number }
  ) => void
  onDeleteUser?: (userId: string) => void
}

function TraineeGroup({
  label,
  trainees,
  showGrades,
  showProfiles,
  currentUserRole,
  onUpdateTrainee,
  onUpdateUser,
  onDeleteUser,
}: {
  label: string
  trainees: Trainee[]
  showGrades?: boolean
  showProfiles?: boolean
  currentUserRole?: string
  onUpdateTrainee?: (id: string, data: { rotacao?: number }) => void
  onUpdateUser?: (id: string, data: any) => void
  onDeleteUser?: (id: string) => void
}) {
  if (trainees.length === 0) return null
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-1">
        {label} <span className="text-xs normal-case font-normal">({trainees.length})</span>
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {trainees.map((trainee) => (
          <div key={trainee.id} className="relative group">
            <TraineeCard
              id={trainee.id}
              name={trainee.name}
              photo={trainee.photo}
              notaRotacao={trainee.notaRotacao}
              rotacao={trainee.rotacao}
              showGrade={showGrades}
              showProfile={showProfiles}
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/80 backdrop-blur-sm p-1 rounded-md border border-border">
              {onUpdateUser && onDeleteUser && (
                <UserEditModal
                  user={{
                    id: trainee.id,
                    name: trainee.name,
                    email: trainee.email,
                    cargo: "Trainee",
                    type: "trainee",
                    rotacao: trainee.rotacao,
                  }}
                  currentUserRole={currentUserRole}
                  onSave={async (data) => {
                    // Save general user data first
                    await onUpdateUser(trainee.id, data)
                    // Then update rotacao via trainee endpoint if changed
                    if (data.rotacao !== undefined && onUpdateTrainee) {
                      await onUpdateTrainee(trainee.id, { rotacao: data.rotacao })
                    }
                  }}
                  onDelete={() => onDeleteUser(trainee.id)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function UsersSection({
  members,
  trainees,
  showGrades = false,
  showProfiles = false,
  membersTitle = "Membros & Equipe",
  currentUserRole = "admin",
  onUpdateTrainee,
  onUpdateUser,
  onDeleteUser,
}: UsersSectionProps) {
  const rot1 = trainees.filter(t => t.rotacao === 1)
  const rot2 = trainees.filter(t => t.rotacao === 2)
  const noRot = trainees.filter(t => !t.rotacao)

  return (
    <div className="space-y-8">
      {/* Membros */}
      {members.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              {membersTitle}
            </h2>
            <span className="text-sm text-muted-foreground">
              {members.length} membro(s)
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {members.map((member) => (
              <div key={member.id} className="relative group">
                <MemberCard
                  id={member.id}
                  name={member.name}
                  eixo={member.eixo}
                  cargo={member.cargo}
                  photo={member.photo}
                  showProfile={showProfiles}
                />
                {onUpdateUser && onDeleteUser && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/80 backdrop-blur-sm p-1 rounded-md border border-border">
                    <UserEditModal
                      user={{
                        id: member.id,
                        name: member.name,
                        email: member.email,
                        cargo: member.cargo,
                        type: member.type,
                        eixo: member.eixo,
                      }}
                      currentUserRole={currentUserRole}
                      onSave={(data) => onUpdateUser(member.id, data)}
                      onDelete={() => onDeleteUser(member.id)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
        {trainees.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum trainee cadastrado ainda.
          </p>
        ) : (
          <div className="space-y-6">
            <TraineeGroup
              label="Rotação 1"
              trainees={rot1}
              showGrades={showGrades}
              showProfiles={showProfiles}
              currentUserRole={currentUserRole}
              onUpdateTrainee={onUpdateTrainee}
              onUpdateUser={onUpdateUser}
              onDeleteUser={onDeleteUser}
            />
            <TraineeGroup
              label="Rotação 2"
              trainees={rot2}
              showGrades={showGrades}
              showProfiles={showProfiles}
              currentUserRole={currentUserRole}
              onUpdateTrainee={onUpdateTrainee}
              onUpdateUser={onUpdateUser}
              onDeleteUser={onDeleteUser}
            />
            <TraineeGroup
              label="Sem Rotação"
              trainees={noRot}
              showGrades={showGrades}
              showProfiles={showProfiles}
              currentUserRole={currentUserRole}
              onUpdateTrainee={onUpdateTrainee}
              onUpdateUser={onUpdateUser}
              onDeleteUser={onDeleteUser}
            />
          </div>
        )}
      </div>
    </div>
  )
}

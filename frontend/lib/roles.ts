// lib/roles.ts — Papéis e eixos de membros, com a mesma normalização do servidor.
//
// Registros antigos guardam o nome de exibição ("Conexões"); os novos, o código
// ("conexoes"). A interface compara sempre o código e exibe o nome completo.

export type UserRole = "admin" | "organizador" | "gerente" | "membro" | "trainee"
export type MemberAxis = "vendas" | "conexoes" | "experiencia"

export const memberAxes: MemberAxis[] = ["vendas", "conexoes", "experiencia"]

export const memberAxisLabels: Record<MemberAxis, string> = {
  vendas: "Vendas",
  conexoes: "Conexões",
  experiencia: "Experiência do Consumidor",
}

const axisAliases: Record<string, MemberAxis> = {
  vendas: "vendas",
  conexoes: "conexoes",
  "conexões": "conexoes",
  experiencia: "experiencia",
  "experiência": "experiencia",
  "experiencia do consumidor": "experiencia",
  "experiência do consumidor": "experiencia",
}

export function normalizeAxis(value?: string | null): MemberAxis | null {
  return value ? axisAliases[value.trim().toLocaleLowerCase("pt-BR")] ?? null : null
}

/** Nome para exibir; valores desconhecidos aparecem como estão para serem corrigidos. */
export function axisLabel(value?: string | null): string {
  const axis = normalizeAxis(value)
  return axis ? memberAxisLabels[axis] : value || "—"
}

export function isStaff(type?: string | null): boolean {
  return type === "admin" || type === "organizador" || type === "gerente"
}

/** Eixo administrado por um gerente; null para os demais perfis. */
export function managerAxis(user?: { type: string; eixo?: string | null } | null): MemberAxis | null {
  return user?.type === "gerente" ? normalizeAxis(user.eixo) : null
}

export function homePath(type?: string | null): string {
  if (isStaff(type)) return "/"
  return type === "membro" ? "/membros" : "/trainees"
}

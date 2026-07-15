export type ContentType = "membro" | "trainee" | "pluginfo"
export type Eixo = "vendas" | "conexoes" | "experiencia" | "pluginfo"

export interface ContentDocument {
  name: string
  url: string
}

export interface ContentItem {
  id: string
  name: string
  type: ContentType
  eixo: Eixo
  text: string
  documents: ContentDocument[]
  videos: string[]
}

export const eixoLabels: Record<Eixo, string> = {
  vendas: "Vendas",
  conexoes: "Conexões",
  experiencia: "Experiência do Consumidor",
  pluginfo: "PlugInfo",
}

export const eixoColors: Record<Eixo, string> = {
  vendas: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  conexoes: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  experiencia: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  pluginfo: "bg-violet-500/20 text-violet-400 border-violet-500/30",
}


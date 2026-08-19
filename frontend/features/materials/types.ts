// features/materials/types.ts — Shared Material type definitions

export interface Document {
  id?: string
  name: string
  url: string
}

export interface Material {
  id: string
  name: string
  type: string   // "membro" | "trainee" | "pluginfo"
  eixo: string   // "vendas" | "conexoes" | "experiencia" | "pluginfo" | "trainee"
  text?: string
  documents: Document[]
  videos: string[]  // list of URLs
}

export interface MaterialCreatePayload {
  name: string
  type: string
  eixo: string
  text?: string
  documents: { name: string; url: string }[]
  videos: string[]
}
